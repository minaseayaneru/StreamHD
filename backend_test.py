import os, time, requests
BASE = os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://dora-video-hub.preview.emergentagent.com').rstrip('/') + '/api'
s = requests.Session(); results=[]
def check(name, method, path, validator=None, expected=None, **kwargs):
    try:
        r=s.request(method, BASE+path, timeout=45, **kwargs)
        try: b=r.json()
        except Exception: b=r.text[:300]
        ok=(r.status_code==expected) if expected is not None else 200 <= r.status_code < 300
        if ok and validator: ok=bool(validator(b,r))
        results.append(ok); print(('PASS' if ok else 'FAIL'),name,r.status_code,'' if ok else b); return b,r
    except Exception as e: results.append(False); print('FAIL',name,'EXCEPTION',repr(e)); return None,None

def parse(name,url,provider):
    return check(name,'POST','/parse',lambda b,r:isinstance(b,dict) and b.get('success') is True and b.get('hostType')==provider and b.get('type') in ('embed','video') and (bool(b.get('embedUrl')) or bool(b.get('sources'))),json={'url':url})

cases=[
('streamtape e','https://streamtape.com/e/test_streamtape_id','streamtape'),('streamtape v','https://streamtape.com/v/test_streamtape_id','streamtape'),('streamtape url','https://streamtape.com/test_streamtape_id','streamtape'),
('turbonewvid t','https://turbonewvid.com/t/test_turbonew_id','turbonewvid'),('turbonewvid www query','https://www.turbonewvid.com/t/test_turbonew_id?param=1','turbonewvid'),
('fc2stream root','https://fc2stream.tv/test_fc2_id','fc2stream'),('fc2stream v','https://www.fc2stream.tv/v/test_fc2_id','fc2stream'),('lulustream','https://lulustream.com/e/test_lulu_id','lulustream'),('lulust','https://lulust.com/e/test_lulu_id','lulustream'),
('doodstream','https://doodstream.com/e/test_dood_id','doodstream'),('vidara','https://vidara.so/e/test_vidara_id','vidara'),('mp4upload','https://www.mp4upload.com/embed-test_mp4_id.html','mp4upload'),('turboviplay','https://turboviplay.com/e/test_turbovi_id','turboviplay'),('vk video','https://vkvideo.ru/video-241161797_456239017','vk'),('ok.ru','https://ok.ru/video/1234567890123','okru'),('sibnet','https://video.sibnet.ru/video/1234567/','sibnet')]
for c in cases: parse(*c)
slug='backend-verification-'+str(int(time.time())); payload={'title':'ShinDora Backend Verification','slug':slug,'originalUrl':'https://streamtape.com/e/backend_verification_sample','posterUrl':'','sources':[{'label':'720p HD','file':'https://example.com/media.mp4'}],'subtitles':[]}
created,_=check('links create','POST','/links',lambda b,r:isinstance(b,dict) and b.get('hostType')=='streamtape' and bool(b.get('id')),json=payload)
check('links list','GET','/links',lambda b,r:isinstance(b,list) and any(x.get('slug')==slug for x in b))
if isinstance(created,dict) and created.get('id'):
    check('links get','GET','/links/'+created['id'],lambda b,r:b.get('id')==created['id'] and b.get('slug')==slug)
    check('parse-stream','GET','/parse-stream?slug='+slug,lambda b,r:isinstance(b,dict) and b.get('success') is True and isinstance(b.get('sources'),list))
    check('links delete','DELETE','/links/'+created['id'],lambda b,r:b.get('success') is True)
for ep in ['/stats','/dashboard/stats']:
    check(ep,'GET',ep,lambda b,r:isinstance(b,dict) and isinstance(b.get('stats'),dict) and all(k in b['stats'] for k in ['streamtapeCount','turbonewvidCount','fc2streamCount','doodstreamCount','lulustreamCount','vidaraCount','mp4uploadCount','turboviplayCount','vkCount','okCount','sibnetCount']))
check('login','POST','/auth/login',lambda b,r:b.get('success') is True,json={'username':'admin','password':'admin123','remember':False})
check('session','GET','/auth/session',lambda b,r:b.get('authenticated') is True)
check('logout','POST','/auth/logout',lambda b,r:b.get('success') is True)
check('session after logout','GET','/auth/session',lambda b,r:b.get('authenticated') is False,expected=401)
check('settings get','GET','/settings',lambda b,r:isinstance(b,dict) and all(k in b for k in ['imagekit','admin','player','general']))
for typ,data in [('player',{'playerType':'videojs','autoplay':True,'vastEnabled':False,'vastTags':[],'isAdblockEnabled':False}),('general',{'cdnUrl':'','downloadCdnUrl':'','isCustomDownloadCdnEnabled':False}),('imagekit',{'publicKey':'','privateKey':'','urlEndpoint':''}),('admin',{'username':'admin','password':'admin123'})]:
    check('settings post '+typ,'POST','/settings',lambda b,r:b.get('success') is True,json={'settingsType':typ,**data})
check('subtitle','GET','/subtitle?url=/sample.srt',lambda b,r:(r.status_code==200 and isinstance(b,str) and b.startswith('WEBVTT')) or r.status_code==404)
print('SUMMARY',sum(results),'/',len(results),'passed'); raise SystemExit(0 if all(results) else 1)
