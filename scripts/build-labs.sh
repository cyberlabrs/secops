#!/bin/bash
# Builds the lab Docker image for every course (the image name is lab.image in courses/<course>/content/course.json).
#   bash scripts/build-labs.sh                 all courses, in folder order
#   bash scripts/build-labs.sh 13-scenariji    only the given courses
# Folder order matters: some images are built FROM earlier ones (05 <- 04, 09/12 <- 06, 13 <- 06, 07, 08).
# Courses without a lab/ folder (e.g. 10-ccsp, 11-cissp) reuse another course's image and are skipped.
set -e
cd "$(dirname "$0")/.."
if [ $# -gt 0 ]; then dirs=(); for c in "$@"; do dirs+=("courses/${c%/}/"); done; else dirs=(courses/*/); fi
for c in "${dirs[@]}"; do
  img=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$c/content/course.json','utf8')).lab.image)")
  if [ ! -f "$c/lab/Dockerfile" ]; then echo "== $c -> $img (no lab/ folder, uses another course's image)"; continue; fi
  echo "== $c -> $img"
  docker build -t "$img" "$c/lab"
done
