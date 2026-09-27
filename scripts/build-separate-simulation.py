"""Build one independent video per simulation condition from verified sources."""
import json
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'video-source'
OUT = ROOT / 'static/videos/simulation/separate'
POSTERS = ROOT / 'static/images/simulation/separate'
OUT.mkdir(parents=True, exist_ok=True)
POSTERS.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / 'static/videos/simulation/sources.json').read_text())
outputs = []
for job in manifest['clips']:
    for i, condition in enumerate([job['baseline'].lower(), 'directional']):
        name = f"{job['name']}-{condition}"
        if 'raw_pair' in job:
            source = SOURCE / 'editable-simulation' / job['raw_pair'][i]
            inputs = ['-i', str(source)]
            filters = 'scale=960:540,setsar=1,format=yuv420p'
            crop = None
        else:
            source = SOURCE / 'CEER2V5.mov'
            inputs = ['-ss', str(job['start']), '-i', str(source), '-t', str(job['duration'])]
            crop = job['crops'][i]
            filters = f'crop={crop},scale=960:-2,setsar=1,format=yuv420p'
        target = OUT / f'{name}.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', *inputs, '-map', '0:v:0', '-vf', filters,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an', '-map_metadata', '-1',
            '-movflags', '+faststart', '-y', str(target)], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-frames:v', '1',
            '-q:v', '2', '-y', str(POSTERS / f'{name}.jpg')], check=True)
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', str(target)]))
        v = info['streams'][0]
        outputs.append(dict(name=name, task=job['title'], condition=condition,
            source=str(source.relative_to(ROOT.parent)), crop=crop,
            width=v['width'], height=v['height'], duration=float(info['format']['duration'])))
        print(name, flush=True)
(OUT / 'sources.json').write_text(json.dumps(outputs, indent=2) + '\n')
