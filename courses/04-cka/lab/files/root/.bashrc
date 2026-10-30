[ -f /etc/bash_completion ] && . /etc/bash_completion
for f in /etc/bash_completion.d/kubectl /etc/bash_completion.d/helm; do [ -f "$f" ] && . "$f"; done
. /etc/profile.d/kurs.sh
