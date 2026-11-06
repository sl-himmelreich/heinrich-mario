"""Weekly backup of this branch for handover to another agent.

Builds <branch>_<YYYY-MM-DD>.zip (Moscow date) with:
  - every text file of the project folder (README, scripts);
  - MANIFEST.txt: every file in the branch with size, SHA-256 and a GitHub link at the current commit;
  - BRANCH_INFO.txt: branch, commit, date, recent history.
Large binaries (PPTX, PDF, images) are listed in the manifest, not packed: the Google Drive
connector only accepts file content inline, which limits uploads to small files.

Usage: python3 presentations/backup.py [output_dir]
Prints the Drive title, the local path, and the path of a .b64 file with the base64 content.
"""
import base64
import datetime
import hashlib
import os
import subprocess
import sys
import tempfile
import zipfile
from zoneinfo import ZoneInfo

REPO_URL = 'https://github.com/sl-himmelreich/heinrich-mario'
PROJECT = 'presentations'
MAX_PACKED = 200 * 1024  # bytes; bigger files go to the manifest only
TEXT_EXT = {'.md', '.py', '.sh', '.js', '.json', '.txt', '.xml', '.css', '.html'}


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


root = git('rev-parse', '--show-toplevel')
os.chdir(root)
branch = git('branch', '--show-current')
commit = git('rev-parse', 'HEAD')
today = datetime.datetime.now(ZoneInfo('Europe/Moscow')).date().isoformat()
title = f'{branch}_{today}.zip'
out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'branch_backups')
os.makedirs(out_dir, exist_ok=True)
local_zip = os.path.join(out_dir, title.replace('/', '__'))

files = sorted(set(git('ls-files').splitlines() + git('ls-files', '--others', '--exclude-standard').splitlines()))
manifest = ['# path\tbytes\tsha256\tlink (at backup commit)']
packed = []
for f in files:
    if not os.path.isfile(f):
        continue
    data = open(f, 'rb').read()
    manifest.append(f'{f}\t{len(data)}\t{hashlib.sha256(data).hexdigest()}\t{REPO_URL}/blob/{commit}/{f}')
    if f.startswith(PROJECT + '/') and os.path.splitext(f)[1].lower() in TEXT_EXT and len(data) <= MAX_PACKED:
        packed.append(f)

status = git('status', '--short') or '(clean)'
info = '\n'.join([
    f'branch: {branch}', f'commit: {commit}', f'backup date (Moscow): {today}', f'repository: {REPO_URL}',
    '', 'uncommitted changes:', status, '', 'recent history:', git('log', '--oneline', '-30'),
])

if os.path.exists(local_zip):
    os.remove(local_zip)
with zipfile.ZipFile(local_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in packed:
        z.write(f, f)
    z.writestr('MANIFEST.txt', '\n'.join(manifest) + '\n')
    z.writestr('BRANCH_INFO.txt', info + '\n')

raw = open(local_zip, 'rb').read()
b64_path = local_zip + '.b64'
open(b64_path, 'w').write(base64.b64encode(raw).decode())
print('drive_title:', title)
print('local_zip:', local_zip)
print('b64_file:', b64_path)
print('zip_bytes:', len(raw), '| base64_chars:', os.path.getsize(b64_path), '| sha256:', hashlib.sha256(raw).hexdigest())
print('packed:', ', '.join(packed) or '-')
