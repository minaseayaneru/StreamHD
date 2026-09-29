import os, time, requests
BASE=os.environ.get('NEXT_PUBLIC_BASE_URL','https://dora-video-hub.preview.emergentagent.com').rstrip('/')+'/api'
s=requests.Session(); results=[]
def check(name, method, path, expected=None, validator=None, **kw):
    try:
        r=s.request(method,BASE+path,timeout=60,**kw)
        try: b=r.json()
        except Exception: b=r.text[:200]
        ok=(r.status_code==expected if expected is not None else 200<=r.status_code<300)
        if ok and validator: ok=bool(validator(b,r))
        results.append(ok); print(('PASS' if ok else 'FAIL'),name,r.status_code, '' if ok else b)
        return b
    except Exception as e: results.append(False); print('FAIL',name,'EXCEPTION',repr(e))

def valid(provider):
    def v(b,r):
        src=b.get('sources',[]) if isinstance(b,dict) else []
        return b.get('success') is True and b.get('hostType')==provider and len(src)>0 and all(x.get('file','').startswith('/api/stream') and x.get('label','').strip() and x.get('type','').strip() for x in src)
    return v
cases=[
('dood playmogo','https://playmogo.com/e/88k96e7mo6j9','doodstream'),('doodstream','https://doodstream.com/e/88k96e7mo6j9','doodstream'),
('vidara so','https://vidara.so/e/vid_test_123','vidara'),('vidara to','https://vidara.to/v/vid_test_123','vidara'),
('lulu stream','https://lulustream.com/e/lulu_test_123','lulustream'),('lulust','https://lulust.com/e/lulu_test_123','lulustream'),
('turbo new','https://turbonewvid.com/t/tnv_test_123','turbonewvid'),('turbo www','https://www.turbonewvid.com/t/tnv_test_123','turbonewvid'),
('fc2','https://fc2stream.tv/fc2_test_123','fc2stream'),('fc2 www','https://www.fc2stream.tv/fc2_test_123','fc2stream'),
('streamtape','https://streamtape.com/e/st_test_123','streamtape'),('mp4upload','https://www.mp4upload.com/embed-test_mp4_id.html','mp4upload'),
('turboviplay','https://turboviplay.com/e/test_turbovi_id','turboviplay'),('vk','https://vkvideo.ru/video-241161797_456239017','vk'),
('ok','https://ok.ru/video/1234567890123','okru'),('sibnet','https://video.sibnet.ru/video/1234567/','sibnet')]
for n,u,p in cases: check('parse '+n,'POST','/parse',validator=valid(p),json={'url':u})
slug='native-backend-'+str(int(time.time()))
created=check('links POST','POST','/links',validator=lambda b,r:b.get('hostType')=='doodstream' and b.get('id'),json={'title':'Native Playback Verification','slug':slug,'originalUrl':'https://playmogo.com/e/88k96e7mo6j9','sources':[{'label':'720p HD','file':'/api/stream/720/'+slug,'type':'video'}]})
check('links GET','GET','/links',validator=lambda b,r:isinstance(b,list) and any(x.get('slug')==slug for x in b))
if isinstance(created,dict) and created.get('id'):
    check('parse-stream','GET','/parse-stream?slug='+slug,validator=lambda b,r:b.get('success') is True and b.get('sources'))
    check('links DELETE','DELETE','/links/'+created['id'],validator=lambda b,r:b.get('success') is True)
for ep in ['/stats','/dashboard/stats']: check(ep,'GET',ep,validator=lambda b,r:isinstance(b.get('stats'),dict))
check('auth login','POST','/auth/login',validator=lambda b,r:b.get('success') is True,json={'username':'admin','password':'admin123','remember':False})
check('auth session','GET','/auth/session',validator=lambda b,r:b.get('authenticated') is True)
check('auth logout','POST','/auth/logout',validator=lambda b,r:b.get('success') is True)
check('auth session logged out','GET','/auth/session',expected=401,validator=lambda b,r:b.get('authenticated') is False)
print('SUMMARY',sum(results),'/',len(results),'passed'); raise SystemExit(0 if all(results) else 1)
