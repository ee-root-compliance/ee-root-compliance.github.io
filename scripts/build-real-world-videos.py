"""Build the local real-world video comparisons from verified project footage."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'video-source'
OUTPUT = ROOT / 'static/videos/experiments'
POSTERS = ROOT / 'static/images/experiments'
OUTPUT.mkdir(parents=True, exist_ok=True)
POSTERS.mkdir(parents=True, exist_ok=True)
PROJECT = ROOT / 'static/videos/ceer2-project.mp4'
jobs = []
# Preserve the film's existing stiffness labels, yellow guides, arrows and timing.
for stiffness, x in [(600, 6), (200, 646), (100, 1286)]:
    jobs.append(dict(name=f'battery-{stiffness}', source=PROJECT, start=0.133333,
                     duration=3.9, crop=f'crop=628:900:{x}:180', hdr=False))
# The film establishes the condition mapping and includes the writing close-ups.
for condition, x in [('soft', 16), ('stiff', 652), ('directional', 1288)]:
    jobs.append(dict(name=f'writing-{condition}', source=PROJECT, start=59.5,
                     duration=11.8, crop=f'crop=616:810:{x}:188', hdr=False))
for name, file, start, duration in [
    ('carrying', 'longbox_nopayload.MOV', .5, 18.5),
    ('carrying-payload', 'longbox_payload1.MOV', .5, 21),
]:
    jobs.append(dict(name=name, source=SOURCE / file, start=start,
                     duration=duration, hdr=True))

def build(job):
    if job['hdr']:
        filters = ('scale=960:-2:out_primaries=bt709:out_transfer=linear,'
                   'format=gbrpf32le,exposure=exposure=-0.8,tonemap=mobius:desat=0:peak=10,'
                   'scale=out_color_matrix=bt709:out_primaries=bt709:out_transfer=bt709,format=yuv420p')
    else:
        filters = job['crop'] + ',format=yuv420p'
    target = OUTPUT / (job['name'] + '.mp4')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(job['start']),
                    '-i', str(job['source']), '-t', str(job['duration']), '-map', '0:v:0',
                    '-vf', filters, '-r', '30', '-c:v', 'libx264', '-preset', 'fast',
                    '-crf', '21', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                    '-colorspace', 'bt709', '-an', '-map_metadata', '-1',
                    '-movflags', '+faststart', '-y', str(target)], check=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', '0.8', '-i',
                    str(target), '-frames:v', '1', '-q:v', '2', '-y',
                    str(POSTERS / (job['name'] + '.jpg'))], check=True)
    return job['name']

if __name__ == '__main__':
    selected = [job for job in jobs if not sys.argv[1:] or job['name'] in sys.argv[1:]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for name in pool.map(build, selected):
            print(name, flush=True)
    manifest = [{**job, 'source': str(job['source'].relative_to(ROOT.parent))} for job in jobs]
    (OUTPUT / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
