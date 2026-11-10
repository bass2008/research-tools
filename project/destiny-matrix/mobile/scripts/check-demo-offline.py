"""Verify an empty-install demo on a standalone APK, then restore device radios.

Clears only com.arcanasense.app's test-device data. Deliberately refuses a debug
build: a Metro bundle downloaded before this check is not a cold offline launch.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

PROJECT = Path(__file__).resolve().parents[2]
APP_ID = 'com.arcanasense.app'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=PROJECT / 'out/mobile-concepts/offline')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    adb = ['adb', '-s', args.device]

    def shell(*command):
        return subprocess.check_output(adb + ['shell', *command], text=True, timeout=30).strip()

    subprocess.run(adb + ['install', '-r', str(args.apk.resolve())], check=True, timeout=120)
    package = shell('dumpsys', 'package', APP_ID)
    if re.search(r'(?:pkgFlags|flags)=\[[^\]]*\bDEBUGGABLE\b', package):
        raise RuntimeError('Use the standalone release APK for a true cold offline check')
    before = {key: shell('settings', 'get', 'global', key)
              for key in ('airplane_mode_on', 'wifi_on', 'mobile_data')}
    reverse = subprocess.check_output(adb + ['reverse', '--list'], text=True, timeout=15).strip().splitlines()
    evidence = {'device': args.device, 'started_at': datetime.now(timezone.utc).isoformat(),
                'apk_sha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(),
                'before': before, 'previous_reverse': reverse}
    try:
        subprocess.run(adb + ['reverse', '--remove-all'], check=True, timeout=15)
        shell('cmd', 'connectivity', 'airplane-mode', 'enable')
        shell('svc', 'wifi', 'disable')
        shell('svc', 'data', 'disable')
        current = {key: shell('settings', 'get', 'global', key) for key in before}
        if current['airplane_mode_on'] != '1' or current['wifi_on'] != '0' or current['mobile_data'] != '0':
            raise RuntimeError(f'Network was not disabled: {current}')
        evidence['offline'] = current
        evidence['offline_routes'] = shell('ip', 'route')
        evidence['offline_routes_ipv6'] = shell('ip', '-6', 'route')
        if re.search(r'^default\b', evidence['offline_routes'] + '\n' + evidence['offline_routes_ipv6'], re.MULTILINE):
            raise RuntimeError('A default network route remains; cannot claim a disconnected cold launch')
        evidence['reverse_during_check'] = subprocess.check_output(adb + ['reverse', '--list'], text=True, timeout=15).strip()
        if evidence['reverse_during_check']:
            raise RuntimeError('An adb reverse still exposes a host service')
        with (output / 'maestro.log').open('w') as log:
            result = subprocess.run(['maestro', '--device', args.device, 'test', '--test-output-dir', str(output / 'run'),
                                     str(PROJECT / 'mobile/flows/demo-offline.yaml')], cwd=PROJECT,
                                    stdout=log, stderr=subprocess.STDOUT, timeout=600)
        evidence['exit_code'] = result.returncode
        print('Cold offline demo:', 'PASS' if result.returncode == 0 else 'FAIL', flush=True)
        if result.returncode:
            raise RuntimeError(f'Offline demo failed. See {output / "maestro.log"}')
    finally:
        shell('cmd', 'connectivity', 'airplane-mode', 'enable' if before['airplane_mode_on'] == '1' else 'disable')
        shell('svc', 'wifi', 'enable' if before['wifi_on'] not in ('0', 'null') else 'disable')
        shell('svc', 'data', 'enable' if before['mobile_data'] == '1' else 'disable')
        for line in reverse:
            columns = line.split()
            if len(columns) >= 3:
                subprocess.run(adb + ['reverse', columns[-2], columns[-1]], check=True, timeout=15)
        evidence['restored'] = {key: shell('settings', 'get', 'global', key) for key in before}
        evidence['finished_at'] = datetime.now(timezone.utc).isoformat()
        (output / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')


if __name__ == '__main__':
    main()
