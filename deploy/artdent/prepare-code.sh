#!/usr/bin/env bash
set -euo pipefail
# Run on the execution VM. Source revisions match Code Interpreter v1.4.1.
destination=/opt/artdent-code
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$destination/vendor/nsjail/kafel"
curl -fL --retry 3 --max-time 120 \
  https://codeload.github.com/LibreChat-AI/code-interpreter/tar.gz/c8b3e1490416753b6f633e4cdbf9100e93aeb849 \
  -o "$scratch/code.tar.gz"
tar -xf "$scratch/code.tar.gz" --strip-components=1 -C "$destination"
curl -fL --retry 3 --max-time 120 \
  https://codeload.github.com/google/nsjail/tar.gz/66ad78dc361721512fbf9470488e584364c75489 \
  -o "$scratch/nsjail.tar.gz"
curl -fL --retry 3 --max-time 120 \
  https://codeload.github.com/google/kafel/tar.gz/76d0f41bf3eb5c4008713d64b9767b461a9129a3 \
  -o "$scratch/kafel.tar.gz"
(
  cd "$scratch"
  sha256sum -c <<'CHECKSUMS'
8d68fcff24719456b5e60cd52aa335cef8cf8a172c640be39255231fbe7a32a6  nsjail.tar.gz
b9a99b91af7abc84664803709072ee7f6a787dd3f39686484503154d93ef8f33  kafel.tar.gz
CHECKSUMS
)
tar -xf "$scratch/nsjail.tar.gz" --strip-components=1 -C "$destination/vendor/nsjail"
tar -xf "$scratch/kafel.tar.gz" --strip-components=1 -C "$destination/vendor/nsjail/kafel"
# Avoid an unreliable full git-submodule clone inside Docker. Same pinned sources.
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/artdent-code/api/Dockerfile')
source = p.read_text()
start = source.index('RUN git clone -b master --single-branch https://github.com/google/nsjail.git')
end = source.index('\n\n', start)
p.write_text(source[:start] + 'COPY vendor/nsjail/ /nsjail/' + source[end:])
PY
printf '%s\n' c8b3e1490416753b6f633e4cdbf9100e93aeb849 > "$destination/UPSTREAM_COMMIT"
