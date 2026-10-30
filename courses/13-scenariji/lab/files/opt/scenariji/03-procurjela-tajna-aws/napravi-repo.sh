#!/bin/bash
# Pravi git repo izvjestaji-servis iz snimaka u repo/NN/ (svaki commit prepisuje fajlove iz svog direktorija).
# Upotreba: napravi-repo.sh <odredište>
set -e
S=$(cd "$(dirname "$0")" && pwd)/repo
D=${1:-/root/izvjestaji-servis}
rm -rf "$D" && mkdir -p "$D" && cd "$D"
git init -q -b main
git remote add origin https://gitlab.kvadrat.ba/izvjestaji/izvjestaji-servis.git
while IFS='|' read -r dir datum ime mail poruka; do
  cp -r "$S/$dir/." .
  git add -A
  GIT_AUTHOR_NAME="$ime" GIT_AUTHOR_EMAIL="$mail" GIT_AUTHOR_DATE="$datum" \
  GIT_COMMITTER_NAME="$ime" GIT_COMMITTER_EMAIL="$mail" GIT_COMMITTER_DATE="$datum" \
    git commit -q -m "$poruka"
done < "$S/commits.txt"
git update-ref refs/remotes/origin/main HEAD
