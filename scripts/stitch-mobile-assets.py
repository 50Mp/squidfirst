"""Download design assets via Stitch MCP without printing credentials."""
import base64
import json
import hashlib
import os
from pathlib import Path
import sys
import tomllib
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / '.stitch' / 'designs' / 'mobile-v2'
CONFIG = Path.home() / '.codex' / 'config.toml'


def main():
    global DEST
    manifest_option = next((argument.split('=', 1)[1] for argument in sys.argv if argument.startswith('--manifest=')), None)
    destination_option = next((argument.split('=', 1)[1] for argument in sys.argv if argument.startswith('--dest=')), None)
    if destination_option:
        DEST = (ROOT / destination_option).resolve()
        DEST.relative_to(ROOT)
    config = tomllib.loads(CONFIG.read_text(encoding='utf-8-sig'))['mcp_servers']['stitch']
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
    headers.update(config.get('http_headers', {}))
    for name, variable in config.get('env_http_headers', {}).items():
        if os.environ.get(variable):
            headers[name] = os.environ[variable]
    sequence = 0

    def rpc(method, params):
        nonlocal sequence
        sequence += 1
        body = {'jsonrpc': '2.0', 'id': sequence, 'method': method, 'params': params}
        request = urllib.request.Request(config['url'], data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(request, timeout=90) as response:
            session = response.headers.get('Mcp-Session-Id')
            if session:
                headers['Mcp-Session-Id'] = session
            raw = response.read().decode()
        if raw.lstrip().startswith('{'):
            result = json.loads(raw)
        else:
            result = next(json.loads(line[5:]) for line in raw.splitlines()
                          if line.startswith('data:') and json.loads(line[5:]).get('id') == sequence)
        if 'error' in result:
            raise RuntimeError('MCP error code ' + str(result['error'].get('code')))
        return result.get('result', {})

    def tool(name, arguments):
        result = rpc('tools/call', {'name': name, 'arguments': arguments})
        if result.get('isError'):
            raise RuntimeError('Stitch tool failed: ' + name)
        if result.get('structuredContent') is not None:
            return result['structuredContent']
        for content in result.get('content', []):
            if content.get('type') == 'text':
                try:
                    return json.loads(content['text'])
                except (ValueError, KeyError):
                    continue
        raise RuntimeError('No structured data for ' + name)

    rpc('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
                       'clientInfo': {'name': 'squid-first-design-archive', 'version': '1.0'}})
    manifest_path = ROOT / manifest_option if manifest_option else ROOT / '.stitch' / 'mobile-v2-assets.json'
    screens = json.loads(manifest_path.read_text(encoding='utf-8'))
    selection_path = ROOT / '.stitch' / 'mobile-v2-screen-ids.json'
    selected = {screen['id'] for screen in screens} if manifest_option else set(json.loads(selection_path.read_text(encoding='utf-8')))
    only = next((argument.split('=', 1)[1] for argument in sys.argv if argument.startswith('--only=')), None)
    if only:
        selected.intersection_update(only.split(','))
    DEST.mkdir(parents=True, exist_ok=True)
    if '--publish' in sys.argv or '--publish-color' in sys.argv:
        published = []
        suffix = 'color' if '--publish-color' in sys.argv else 'revised'
        for screen in screens:
            screen_id = screen['name'].split('/')[-1]
            html_path = DEST / (screen_id + '.' + suffix + '.html')
            image_path = DEST / (screen_id + '.' + suffix + '.png')
            if screen_id not in selected or not html_path.is_file() or not image_path.is_file():
                continue
            updated = tool('update_screen', {
                'name': screen['name'],
                'htmlCodeBase64': base64.b64encode(html_path.read_bytes()).decode(),
                'screenshotBase64': base64.b64encode(image_path.read_bytes()).decode(),
                'updateMask': ['html_code', 'screenshot'],
            })
            published.append({'id': screen_id, 'name': updated.get('name'), 'htmlCode': updated.get('htmlCode'), 'screenshot': updated.get('screenshot')})
            print(json.dumps({'published': screen_id, 'verified_name': updated.get('name')}, ensure_ascii=False), flush=True)
        result_name = 'published-mobile-color.json' if suffix == 'color' else 'published-mobile-v2.json'
        result_path = DEST.parent / 'published.json' if manifest_option else ROOT / '.stitch' / result_name
        result_path.write_text(json.dumps(published, indent=2), encoding='utf-8')
        return
    if '--verify' in sys.argv:
        checks = []
        for screen in screens:
            screen_id = screen['name'].split('/')[-1]
            if screen_id not in selected:
                continue
            remote = tool('get_screen', {'name': screen['name']})
            asset = remote.get('htmlCode', remote.get('html_code', {}))
            downloaded = tool('download_file', {'name': asset['name']})
            local_bytes = (DEST / (screen_id + '.revised.html')).read_bytes()
            remote_bytes = downloaded['html'].encode('utf-8')
            same = hashlib.sha256(local_bytes).digest() == hashlib.sha256(remote_bytes).digest()
            checks.append({'id': screen_id, 'html_matches_reviewed_file': same})
            print(json.dumps(checks[-1]), flush=True)
        result_path = DEST.parent / 'remote-verification.json' if manifest_option else ROOT / '.stitch' / 'remote-verification.json'
        result_path.write_text(json.dumps(checks, indent=2), encoding='utf-8')
        if not all(check['html_matches_reviewed_file'] for check in checks):
            raise RuntimeError('Remote HTML differs from reviewed files')
        return
    metadata = []
    for screen in screens:
        screen_id = screen['name'].split('/')[-1]
        if screen_id not in selected:
            continue
        entry = {'id': screen_id, 'title': screen.get('title'), 'name': screen['name'], 'assets': {}}
        for field, fallback_extension in [('htmlCode', 'html'), ('screenshot', 'png')]:
            asset = screen.get(field, {})
            if not asset.get('name'):
                continue
            existing = ([DEST / (screen_id + '.html')] if field == 'htmlCode' else
                        [DEST / (screen_id + '.png'), DEST / (screen_id + '.jpg')])
            cached = next((path for path in existing if path.is_file()), None)
            if cached:
                entry['assets'][field] = str(cached.relative_to(ROOT))
                continue
            data = tool('download_file', {'name': asset['name']})
            extension = fallback_extension
            if data.get('html') is not None:
                payload = data['html'].encode('utf-8')
            elif data.get('image'):
                payload = base64.b64decode(data['image'])
                mime = data.get('imageMetadata', data.get('image_metadata', {})).get('mimeType', '')
                if mime == 'image/jpeg' or payload[:2] == b'\xff\xd8':
                    extension = 'jpg'
            else:
                raise RuntimeError('No asset payload for ' + screen_id)
            destination = DEST / (screen_id + '.' + extension)
            destination.write_bytes(payload)
            entry['assets'][field] = str(destination.relative_to(ROOT))
        metadata.append(entry)
        print(json.dumps({'saved': screen_id, 'title': entry['title']}, ensure_ascii=False), flush=True)
    (ROOT / '.stitch' / 'metadata.json').write_text(json.dumps({
        'projectId': '9946906478898127464', 'title': 'Game Top-Up Operations Hub',
        'revision': 'mobile-v2-2026-11-20', 'screens': metadata,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'archived_screens': len(metadata), 'requested_screens': len(selected)}))


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        print(json.dumps({'http_status': error.code}))
        sys.exit(1)
    except Exception as error:
        print(json.dumps({'error_type': type(error).__name__, 'message': str(error) if isinstance(error, RuntimeError) else ''}))
        sys.exit(1)
