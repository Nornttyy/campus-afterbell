import subprocess,json,base64,hashlib,pathlib,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parent.parent
repo='Nornttyy/campus-afterbell'
statepath=root/'.publish-cache.json'
state=json.loads(statepath.read_text()) if statepath.exists() else {'blobs':{}}
def api(route,data=None,allow404=False,method='POST'):
 cmd=['gh','api',f'repos/{repo}/{route}']
 if data is not None:cmd+=['--method',method,'--input','-']
 for attempt in range(4):
  p=subprocess.run(cmd,input=json.dumps(data) if data is not None else None,text=True,capture_output=True,timeout=90)
  transient=any(message in p.stderr for message in ('EOF','connection reset','TLS handshake timeout','HTTP 502','HTTP 503','HTTP 504'))
  if not p.returncode or not transient or attempt==3:break
  time.sleep(2**attempt)
 if p.returncode:
  if allow404 and ('404' in p.stderr or 'Git Repository is empty' in p.stderr):return None
  raise RuntimeError(f'{route}: {p.stderr[:500]}')
 return json.loads(p.stdout) if p.stdout.strip() else {}
head=api('git/ref/heads/main',allow404=True)
if not head:
 data=base64.b64encode((root/'README.md').read_bytes()).decode()
 api('contents/README.md',{'message':'Initialize classroom project','content':data,'branch':'main'},method='PUT')
 head=api('git/ref/heads/main')
parent=head['object']['sha']
# A locally cached SHA may have belonged to an abandoned upload that GitHub
# garbage-collected. Only skip uploads for blobs reachable from the live source.
remote_commit=api('git/commits/'+parent)
remote_tree=api('git/trees/'+remote_commit['tree']['sha']+'?recursive=1')
remote_blobs={entry['sha'] for entry in remote_tree.get('tree',[]) if entry['type']=='blob'}
index=subprocess.check_output(['git','ls-files','--stage','-z'],cwd=root).decode().strip('\0').split('\0')
file_modes={}
for entry in index:
 metadata,name=entry.split('\t',1)
 mode,_,stage=metadata.split()
 assert stage=='0',f'Unresolved index entry: {name}'
 assert mode in ('100644','100755'),f'Unsupported file mode {mode}: {name}'
 file_modes[name]=mode
files=list(file_modes)
def upload(name):
 content=(root/name).read_bytes(); sha=hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
 if state['blobs'].get(name)==sha and sha in remote_blobs:return name,sha
 result=api('git/blobs',{'content':base64.b64encode(content).decode(),'encoding':'base64'})
 assert result['sha']==sha,(name,result['sha'],sha)
 return name,sha
entries=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for name,sha in pool.map(upload,files):
  state['blobs'][name]=sha;statepath.write_text(json.dumps(state))
  entries.append({'path':name,'mode':file_modes[name],'type':'blob','sha':sha})
  print('Uploaded',name,flush=True)
def incremental_tree(entries,base_sha=None):
 desired={e['path']:e for e in entries}
 assert len(desired)==len(entries),'Duplicate publish paths'
 previous={}
 if base_sha:
  previous_tree=api('git/trees/'+base_sha+'?recursive=1')
  assert not previous_tree.get('truncated'),'Cannot safely diff a truncated remote tree'
  previous={e['path']:e for e in previous_tree['tree'] if e['type']!='tree'}
 fields=('mode','type','sha')
 delta=[e for path,e in desired.items() if path not in previous or any(e[k]!=previous[path][k] for k in fields)]
 delta += [{'path':path,'mode':e['mode'],'type':e['type'],'sha':None} for path,e in previous.items() if path not in desired]
 if not delta:return {'sha':base_sha}
 tree={'sha':base_sha}
 for start in range(0,len(delta),48):
  body={'tree':delta[start:start+48]}
  if tree['sha']:body['base_tree']=tree['sha']
  tree=api('git/trees',body)
 actual=api('git/trees/'+tree['sha']+'?recursive=1')
 assert not actual.get('truncated'),'Cannot verify a truncated publication tree'
 actual={e['path']:{k:e[k] for k in fields} for e in actual['tree'] if e['type']!='tree'}
 expected={path:{k:e[k] for k in fields} for path,e in desired.items()}
 assert actual==expected,'Published tree differs from the checked local file snapshot'
 return tree
def publish_branch(branch,entries):
 current=api('git/ref/heads/'+branch,allow404=True)
 parents=[current['object']['sha']] if current else []
 old=api('git/commits/'+parents[0]) if current else None
 tree=incremental_tree(entries,old['tree']['sha'] if old else None)
 if old and old['tree']['sha']==tree['sha']:
  print(branch+' is already up to date',flush=True)
  return parents[0]
 commit=api('git/commits',{'message':'Synchronize classroom reading and writing gestures while preserving authored hands','tree':tree['sha'],'parents':parents})
 if current:
  assert api('git/ref/heads/'+branch)['object']['sha']==parents[0],'Remote changed during upload'
  api('git/refs/heads/'+branch,{'sha':commit['sha'],'force':False},method='PATCH')
 else:api('git/refs',{'ref':'refs/heads/'+branch,'sha':commit['sha']})
 print('Published',branch,commit['sha'],flush=True)
 return commit['sha']
state['head']=publish_branch('main',entries)
static=[dict(e,path=e['path'][5:]) for e in entries if e['path'].startswith('dist/')]
state['pagesHead']=publish_branch('gh-pages',static)
statepath.write_text(json.dumps(state))
pages=api('pages',allow404=True)
if not pages:
 api('pages',{'build_type':'legacy','source':{'branch':'gh-pages','path':'/'}})
elif pages.get('source',{}).get('branch')!='gh-pages':
 api('pages',{'build_type':'legacy','source':{'branch':'gh-pages','path':'/'}},method='PUT')
print('Website: https://nornttyy.github.io/campus-afterbell/',flush=True)
