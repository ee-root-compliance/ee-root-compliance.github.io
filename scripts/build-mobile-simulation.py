"""Rearrange finished simulation pairs vertically without changing their timing."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / 'static/videos/simulation'
POSTERS = ROOT / 'static/images/simulation'
for job in json.loads((VIDEOS / 'sources.json').read_text())['clips']:
    name = job['name']
    target = VIDEOS / f'{name}-mobile.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(VIDEOS / f'{name}.mp4'),
        '-filter_complex', '[0:v]split=2[a][b];[a]crop=iw/2:ih:0:0[top];'
        '[b]crop=iw/2:ih:iw/2:0[bottom];[top][bottom]vstack=inputs=2,setsar=1[out]',
        '-map', '[out]', '-c:v', 'libx264', '-crf', '20', '-preset', 'fast',
        '-an', '-movflags', '+faststart', '-y', str(target)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-frames:v', '1',
        '-q:v', '2', '-y', str(POSTERS / f'{name}-mobile.jpg')], check=True)
    print(name, flush=True)
