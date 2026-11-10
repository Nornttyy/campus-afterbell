"""Exercise the publisher without invoking gh or uploading any repository data."""
import ast
import copy
from pathlib import Path
import unittest


def entry(path, sha, mode='100644'):
    return {'path': path, 'sha': sha, 'mode': mode, 'type': 'blob'}


class TreeTests(unittest.TestCase):
    def setUp(self):
        self.trees = {'base': [entry('dist/a.js', 'old'), entry('stale.js', 'remove')]}
        self.writes = []
        self.truncated = False

        def api(route, data=None):
            if data is None:
                sha = route.split('/')[2].split('?')[0]
                return {'tree': copy.deepcopy(self.trees[sha]), 'truncated': self.truncated}
            self.writes.append(copy.deepcopy(data))
            current = {e['path']: e for e in copy.deepcopy(self.trees.get(data.get('base_tree'), []))}
            for e in data['tree']:
                if e['sha'] is None:
                    current.pop(e['path'], None)
                else:
                    current[e['path']] = e
            sha = f'tree-{len(self.writes)}'
            self.trees[sha] = list(current.values())
            return {'sha': sha}

        source = Path(__file__).parents[1] / 'scripts/publish.py'
        fn = next(n for n in ast.parse(source.read_text()).body if isinstance(n, ast.FunctionDef) and n.name == 'incremental_tree')
        scope = {'api': api}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), str(source), 'exec'), scope)
        self.build = scope['incremental_tree']

    def test_changes_deletions_modes_and_multiple_batches(self):
        desired = [entry('dist/a.js', 'new', '100755')] + [entry(f'dist/files/{i}.js', str(i)) for i in range(120)]
        result = self.build(desired, 'base')
        self.assertEqual(sorted(self.trees[result['sha']], key=lambda x: x['path']), sorted(desired, key=lambda x: x['path']))
        self.assertEqual(len(self.writes), 3)
        self.assertTrue(all(len(w['tree']) <= 48 for w in self.writes))
        self.assertEqual(self.writes[1]['base_tree'], 'tree-1')

    def test_unchanged_tree_requires_no_write(self):
        self.assertEqual(self.build(self.trees['base'], 'base'), {'sha': 'base'})
        self.assertEqual(self.writes, [])

    def test_new_branch(self):
        result = self.build([entry('index.html', 'new')])
        self.assertEqual(self.trees[result['sha']], [entry('index.html', 'new')])
        self.assertNotIn('base_tree', self.writes[0])

    def test_truncated_source_is_rejected_before_any_write(self):
        self.truncated = True
        with self.assertRaises(AssertionError):
            self.build([entry('index.html', 'new')], 'base')
        self.assertEqual(self.writes, [])


if __name__ == '__main__':
    unittest.main()
