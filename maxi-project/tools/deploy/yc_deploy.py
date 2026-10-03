#!/usr/bin/env python3
"""Выкладывает папку dist/ в бакет Яндекс Object Storage (S3-совместимый) с правильными типами файлов.

Зачем свой скрипт: `aws s3 sync` угадывает Content-Type по системной таблице, и .json/.webp/.woff2 нередко уходят
как application/octet-stream — браузер тогда не показывает фото или не берёт шрифты.

Подготовка (один раз, см. docs/mvp-launch.md):
  pip install awscli   (вместе с ним ставится botocore, этого достаточно)
  aws configure        (ключи статического доступа сервисного аккаунта; регион ru-central1)
Запуск:
  YC_BUCKET=имя-бакета python3 tools/deploy/yc_deploy.py [--dry-run] [--delete]
"""
import argparse, mimetypes, os, sys
from pathlib import Path

ENDPOINT = os.environ.get('YC_ENDPOINT', 'https://storage.yandexcloud.net')
TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
         '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
         '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
         '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'}

def client():
    """S3-клиент напрямую из библиотеки (botocore ставится вместе с awscli, boto3 тоже подходит) —
    без запуска команды aws, которая на Windows иногда не стартует. Ключи берутся из `aws configure`."""
    try:
        import boto3
        return boto3.client('s3', endpoint_url=ENDPOINT, region_name='ru-central1')
    except ImportError:
        import botocore.session
        return botocore.session.get_session().create_client('s3', endpoint_url=ENDPOINT, region_name='ru-central1')

def ctype(p):
    return TYPES.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or 'application/octet-stream'

def cache(rel):
    # хешированные файлы сборки не меняются никогда; страница и выгрузки — всегда проверяются заново
    if rel.startswith('assets/') or rel.startswith('feeds/img/'): return 'public, max-age=31536000, immutable'
    return 'no-cache'

def a_dry(a): return a.dry_run

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
    c = None if a_dry(a) else client()
    for p in files:
        rel = p.relative_to(root).as_posix()
        print(('[dry] ' if a.dry_run else '') + f'{rel:50s} {ctype(p):32s} {cache(rel)}')
        if c: c.put_object(Bucket=bucket, Key=rel, Body=p.read_bytes(), ContentType=ctype(p), CacheControl=cache(rel))
    if a.delete and c:
        have = {p.relative_to(root).as_posix() for p in files}
        for page in c.get_paginator('list_objects_v2').paginate(Bucket=bucket):
            for o in page.get('Contents', []):
                if o['Key'] not in have:
                    print('удаляю', o['Key']); c.delete_object(Bucket=bucket, Key=o['Key'])
    print('готово' if not a.dry_run else 'проверка без загрузки завершена')

if __name__ == '__main__': main()
