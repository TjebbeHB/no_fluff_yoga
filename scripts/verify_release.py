"""Verify the local versioned personal-testing APK against preserved releases."""
import hashlib, json, pathlib, subprocess, zipfile
root=pathlib.Path(__file__).resolve().parent.parent
config=json.loads((root/'app.json').read_text())['expo']
version=config['version']; version_code=config['android']['versionCode']
apk=root/f'releases/verdant-yoga-{version}.apk'
sdk=pathlib.Path.home()/'Library/Android/sdk/build-tools/36.0.0'
java='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java'
def run(*args):return subprocess.check_output([str(x) for x in args],text=True)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def signer(path):
 result=run(java,'-jar',sdk/'lib/apksigner.jar','verify','--verbose','--print-certs',path)
 return next(line for line in result.splitlines() if 'certificate SHA-256 digest:' in line)
old={'1.0.0':'666a8679e2d261b0d8aeaf2e27fecf847e974821c6406889df42b763f79330a6','1.1.0':'8067f70ff99b00fa9bd32522d3dd7897be1cbf10b33ad243561d5ff5cd77b1b5','1.2.0':'6dbd87a8c236e2186a7b15a50f66f3e2f42982f657601994dff8d8867846b91d'}
for prior_version,expected in old.items():assert digest(root/f'releases/verdant-yoga-{prior_version}.apk')==expected
assert signer(apk)==signer(root/'releases/verdant-yoga-1.1.0.apk')
align=run(sdk/'zipalign','-c','-P','16','-v','4',apk)
assert 'Verification successful' in align
badging=run(sdk/'aapt','dump','badging',apk)
assert f"name='com.verdant.yoga' versionCode='{version_code}' versionName='{version}'" in badging
assert 'application-debuggable' not in badging
manifest=run(sdk/'aapt','dump','xmltree',apk,'AndroidManifest.xml')
assert 'android.intent.action.TTS_SERVICE' in manifest
for unwanted in ['RECORD_AUDIO','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','SYSTEM_ALERT_WINDOW']:assert unwanted not in manifest
assets={}
with zipfile.ZipFile(apk) as archive:
 assert archive.testzip() is None
 hashes={hashlib.sha256(archive.read(name)).hexdigest():name for name in archive.namelist() if name.endswith('.wav') or name.startswith('assets/')}
 for name in ['natural-rain.wav','natural-birds.wav','natural-stream.wav','transition-bell.wav']:
  sha=digest(root/'assets'/name);assert sha in hashes,name;assets[name]={'sha256':sha,'apkEntry':hashes[sha]}
result={'file':str(apk),'sizeMiB':round(apk.stat().st_size/1024**2,1),'sha256':digest(apk),'package':'com.verdant.yoga','version':version,'versionCode':version_code,'minimumAndroid':'7.0 (API 24)','build':'Gradle app:assembleRelease successful','signing':'Default Android debug certificate; non-debuggable release-mode personal testing APK','signatureVerified':True,'sameSignerAs1_1_0':True,'earlierApksUnchanged':True,'alignment16KiBVerified':True,'zipIntegrityVerified':True,'ttsServiceQueryVerified':True,'bundledAudio':assets,'physicalDeviceTested':False,'subjectiveListeningVerified':False,'uploaded':False}
(root/f'releases/build-verification-{version}.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
