"""Build simulation comparisons from verified Drive film and editing-project sources.

Keep paired conditions in one video so the original comparison timing, speed
labels, annotations and outcomes remain intact. No color or exposure filters.
"""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'video-source/CEER2V5.mov'
OUTPUT = ROOT / 'static/videos/simulation'
POSTERS = ROOT / 'static/images/simulation'
# The first two tasks use full source clips from the verified editing project.
RAW = ROOT.parent / 'video-source/editable-simulation'
JOBS = [
    dict(name='table-wiping-full', title='Table Wiping', start=0, duration=16.36,
         baseline='Stiff', raw_pair=['v2fill_table_wipe__S-STIFF_verystiff.mp4',
                                   'v2fill_table_wipe__S-SOFT_my_custom.mp4']),
    dict(name='peg-insertion-full', title='Peg Insertion', start=0, duration=23.84,
         baseline='Stiff', raw_pair=['v2fill_peg_in_hole__S-STIFF_verystiff.mp4',
                                   'v2fill_peg_in_hole__S-SOFT_my_custom.mp4']),
    dict(name='figure-eight-writing', title='Figure-eight Writing', start=35, duration=9.5,
         baseline='Stiff', crops=['836:470:230:36', '836:470:230:510']),
    dict(name='box-lifting', title='Box Lifting', start=35, duration=9.5,
         baseline='Stiff', crops=['836:470:1070:36', '836:470:1070:510']),
    dict(name='collaborative-carrying-pair', title='Collaborative Carrying', start=44.5, duration=12,
         baseline='Soft', crops=['1176:490:452:20', '1176:490:452:516']),
]

if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    for job in JOBS:
        target = OUTPUT / (job['name'] + '.mp4')
        if sys.argv[1:] and job['name'] not in sys.argv[1:]:
            continue
        if 'raw_pair' in job:
            inputs = ['-i', str(RAW / job['raw_pair'][0]), '-i', str(RAW / job['raw_pair'][1])]
            filters = (
                '[0:v]setpts=PTS-STARTPTS,fps=30,scale=768:432,setsar=1[left];'
                '[1:v]setpts=PTS-STARTPTS,fps=30,scale=768:432,setsar=1,'
                f"tpad=stop_mode=clone:stop_duration={job['duration']}[right];"
                '[left][right]hstack=inputs=2:shortest=1,format=yuv420p[out]')
        else:
            inputs = ['-ss', str(job['start']), '-i', str(SOURCE)]
            filters = (
                f"[0:v]split=2[a][b];[a]crop={job['crops'][0]},scale=720:-2[left];"
                f"[b]crop={job['crops'][1]},scale=720:-2[right];"
                '[left][right]hstack=inputs=2,setsar=1,format=yuv420p[out]')
        subprocess.run(['ffmpeg', '-v', 'error', *inputs,
            '-t', str(job['duration']), '-filter_complex', filters,
            '-map', '[out]', '-c:v', 'libx264',
            '-preset', 'fast', '-crf', '20', '-an', '-map_metadata', '-1',
            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
            '-movflags', '+faststart', '-y', str(target)], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target),
            '-frames:v', '1', '-q:v', '2', '-y', str(POSTERS / (job['name'] + '.jpg'))], check=True)
        print(job['name'], flush=True)
    (OUTPUT / 'sources.json').write_text(json.dumps({
        'source': 'video-source/CEER2V5.mov',
        'raw_source_archive': 'https://drive.google.com/file/d/1b3fqOGcuzUMiMSej6nmvXhB_vYS9eEFL/view',
        'raw_condition_mapping': 'Verified against CEER2/draft_info.json: S-STIFF upper (Stiff), S-SOFT lower (Directional) for wiping and insertion.',
        'raw_playback': 'Full clips from frame zero at 1x; shorter clip holds its actual final frame while the other completes.',
        'drive_url': 'https://drive.google.com/file/d/1d6K0uwXqjZw3rJKMp1ge1Wb982GvpUQS/view',
        'notes': 'Each task is cropped into a synchronized horizontal pair, baseline left and directional right. Original timing, playback-speed labels and outcomes retained; condition labels are in HTML. No exposure adjustment.',
        'clips': JOBS,
    }, indent=2) + '\n')
