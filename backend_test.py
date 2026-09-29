import os
import time
import requests

BASE = os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://dora-video-hub.preview.emergentagent.com').rstrip('/') + '/api'
s = requests.Session()
results = []

def check(name, method, path, expected=None, validator=None, **kwargs):
    try:
        r = s.request(method, BASE + path, timeout=30, **kwargs)
        try:
            body = r.json()
        except Exception:
            body = r.text[:300]
        ok = (r.status_code == expected) if expected is not None else 200 <= r.status_code < 300
        if ok and validator:
            ok = bool(validator(body, r))
        results.append(ok)
        print(('PASS' if ok else 'FAIL'), name, r.status_code, '' if ok else body)
        return body, r
    except Exception as exc:
        results.append(False)
        print('FAIL', name, 'EXCEPTION', repr(exc))
        return None, None

# Parser coverage requested for all supported providers using representative public-shaped URLs.
parse_cases = {
    'streamtape': 'https://streamtape.com/e/test_streamtape_id',
    'turbonewvid': 'https://turbonewvid.com/t/test_turbonew_id',
    'fc2stream': 'https://fc2stream.tv/test_fc2_id',
    'doodstream': 'https://doodstream.com/e/test_dood_id',
    'lulustream': 'https://lulustream.com/e/test_lulu_id',
    'vidara': 'https://vidara.so/e/test_vidara_id',
    'mp4upload': 'https://www.mp4upload.com/embed-test_mp4_id.html',
    'turboviplay': 'https://turboviplay.com/e/test_turbovi_id',
    'vk': 'https://vkvideo.ru/video-241161797_456239017',
}
for provider, url in parse_cases.items():
    check('parse ' + provider, 'POST', '/parse', validator=lambda b, r, p=provider: isinstance(b, dict) and b.get('hostType') == p and isinstance(b.get('sources'), list) and len(b['sources']) > 0, json={'url': url})

# Links create/list/get and cleanup against Turso-backed API.
slug = 'backend-verification-' + str(int(time.time()))
payload = {'title': 'ShinDora Backend Verification', 'slug': slug, 'originalUrl': 'https://streamtape.com/e/backend_verification_sample', 'posterUrl': '', 'sources': [{'label': '720p HD', 'file': 'https://example.com/media.mp4'}], 'subtitles': []}
created, _ = check('links create', 'POST', '/links', validator=lambda b, r: isinstance(b, dict) and b.get('hostType') == 'streamtape' and bool(b.get('id')), json=payload)
check('links list', 'GET', '/links', validator=lambda b, r: isinstance(b, list) and any(x.get('slug') == slug for x in b))
if isinstance(created, dict) and created.get('id'):
    check('links get by id', 'GET', '/links/' + created['id'], validator=lambda b, r: isinstance(b, dict) and b.get('id') == created['id'] and b.get('slug') == slug)
    check('links delete', 'DELETE', '/links/' + created['id'], validator=lambda b, r: isinstance(b, dict) and b.get('success') is True)

# Stats endpoints and provider counters.
stats_keys = ['streamtapeCount', 'turbonewvidCount', 'fc2streamCount', 'doodstreamCount', 'lulustreamCount', 'vidaraCount', 'mp4uploadCount', 'turboviplayCount', 'vkCount', 'okCount', 'sibnetCount']
for endpoint in ['/stats', '/dashboard/stats']:
    check(endpoint, 'GET', endpoint, validator=lambda b, r: isinstance(b, dict) and isinstance(b.get('stats'), dict) and all(k in b['stats'] for k in stats_keys))

# Auth login/session/logout lifecycle.
check('auth login', 'POST', '/auth/login', validator=lambda b, r: isinstance(b, dict) and b.get('success') is True and ('session_token' in s.cookies or 'session_token' in r.headers.get('set-cookie', '')), json={'username': 'admin', 'password': 'admin123', 'remember': False})
check('auth session', 'GET', '/auth/session', validator=lambda b, r: isinstance(b, dict) and b.get('authenticated') is True)
check('auth logout', 'POST', '/auth/logout', validator=lambda b, r: isinstance(b, dict) and b.get('success') is True)
check('auth session after logout', 'GET', '/auth/session', expected=401, validator=lambda b, r: isinstance(b, dict) and b.get('authenticated') is False)

# Settings read/write (use a reversible-looking verification value and confirm response shape).
check('settings get', 'GET', '/settings', validator=lambda b, r: isinstance(b, dict) and all(k in b for k in ['imagekit', 'admin', 'player', 'general']))
check('settings post player', 'POST', '/settings', validator=lambda b, r: isinstance(b, dict) and b.get('success') is True, json={'settingsType': 'player', 'playerType': 'videojs', 'autoplay': True, 'vastEnabled': False, 'vastTags': [], 'isAdblockEnabled': False})
check('settings post general', 'POST', '/settings', validator=lambda b, r: isinstance(b, dict) and b.get('success') is True, json={'settingsType': 'general', 'cdnUrl': '', 'downloadCdnUrl': '', 'isCustomDownloadCdnEnabled': False})

# Local sample subtitle should be converted to VTT or report the expected missing-file 404.
check('subtitle sample', 'GET', '/subtitle?url=/sample.srt', validator=lambda b, r: (r.status_code == 200 and isinstance(b, str) and b.startswith('WEBVTT')) or r.status_code == 404)

print('SUMMARY', sum(results), '/', len(results), 'passed')
raise SystemExit(0 if all(results) else 1)
