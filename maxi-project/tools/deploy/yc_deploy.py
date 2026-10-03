#!/usr/bin/env python3
"""Выкладывает папку dist/ в бакет Яндекс Object Storage (S3-совместимый) с правильными типами файлов.

Зачем свой скрипт: `aws s3 sync` угадывает Content-Type по системной таблице, и .json/.webp/.woff2 нередко уходят
как application/octet-stream — браузер тогда не показывает фото или не берёт шрифты.

Подготовка (один раз, см. docs/mvp-launch.md):
  pip install awscli   (или любой aws cli v2)
  aws configure        (ключи статического доступа сервисного аккаунта; регион ru-central1)
Запуск:
  YC_BUCKET=имя-бакета python3 tools/deploy/yc_deploy.py [--dry-run] [--delete]
"""
import argparse, mimetypes, os, subprocess, sys
from pathlib import Path

ENDPOINT = os.environ.get('YC_ENDPOINT', 'https://storage.yandexcloud.net')
TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
         '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
         '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
         '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'}

def ctype(p):
    return TYPES.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or 'application/octet-stream'

def cache(rel):
    # хешированные файлы сборки не меняются никогда; страница и выгрузки — всегда проверяются заново
    if rel.startswith('assets/') or rel.startswith('feeds/img/'): return 'public, max-age=31536000, immutable'
    return 'no-cache'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='dist'); ap.add_argument('--bucket', default=os.environ.get('YC_BUCKET'))
    ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--delete', action='store_true', help='убрать из бакета файлы, которых нет в dist')
    a = ap.parse_args()
    root = Path(a.dir)
    if not (root / 'index.html').exists(): sys.exit(f'нет {root}/index.html — сначала npm run build')
    if not a.bucket and not a.dry_run: sys.exit('укажи бакет: YC_BUCKET=имя python3 tools/deploy/yc_deploy.py')
    bucket = a.bucket or 'BUCKET'
    files = sorted(p for p in root.rglob('*') if p.is_file())
    total = sum(p.stat().st_size for p in files)
    print(f'{len(files)} файлов, {total/1e6:.1f} МБ → s3://{bucket} ({ENDPOINT})')
    if total > 900e6: print('ВНИМАНИЕ: больше ~1 ГБ — выйдешь за бесплатный лимит хранилища')
    # сначала всё, кроме index.html, потом страница: посетитель не увидит новую страницу без её файлов
    files.sort(key=lambda p: p.name == 'index.html')
    for p in files:
        rel = p.relative_to(root).as_posix()
        cmd = ['aws', '--endpoint-url', ENDPOINT, 's3', 'cp', str(p), f's3://{bucket}/{rel}', '--content-type', ctype(p),
               '--cache-control', cache(rel), '--only-show-errors']
        print(('[dry] ' if a.dry_run else '') + f'{rel:50s} {ctype(p):32s} {cache(rel)}')
        if not a.dry_run: subprocess.run(cmd, check=True)
    if a.delete and not a.dry_run:
        have = {p.relative_to(root).as_posix() for p in files}
        out = subprocess.run(['aws', '--endpoint-url', ENDPOINT, 's3', 'ls', f's3://{bucket}/', '--recursive'], check=True, capture_output=True, text=True).stdout
        for line in out.splitlines():
            key = line.split(None, 3)[-1]
            if key not in have:
                print('удаляю', key); subprocess.run(['aws', '--endpoint-url', ENDPOINT, 's3', 'rm', f's3://{bucket}/{key}', '--only-show-errors'], check=True)
    print('готово' if not a.dry_run else 'проверка без загрузки завершена')

if __name__ == '__main__': main()
