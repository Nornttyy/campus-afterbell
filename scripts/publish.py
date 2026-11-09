import subprocess,json,base64,hashlib,pathlib,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parent.parent
repo='Nornttyy/campus-afterbell'
statepath=root/'.publish-cache.json'
state=json.loads(statepath.read_text()) if statepath.exists() else {'blobs':{}}
def api(route,data=None,allow404=False,method='POST'):
 cmd=['gh','api',f'repos/{repo}/{route}']
 if data is not None:cmd+=['--method',method,'--input','-']
 p=subprocess.run(cmd,input=json.dumps(data) if data is not None else None,text=True,capture_output=True,timeout=90)
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
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().strip('\0').split('\0')
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
  entries.append({'path':name,'mode':'100644','type':'blob','sha':sha})
  print('Uploaded',name,flush=True)
def publish_branch(branch,entries):
 current=api('git/ref/heads/'+branch,allow404=True)
 parents=[current['object']['sha']] if current else []
 tree=api('git/trees',{'tree':entries})
 if current:
  old=api('git/commits/'+parents[0])
  if old['tree']['sha']==tree['sha']:
   print(branch+' is already up to date',flush=True)
   return parents[0]
 commit=api('git/commits',{'message':'Update classroom roles, room settings, movement and multiplayer fixes','tree':tree['sha'],'parents':parents})
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
