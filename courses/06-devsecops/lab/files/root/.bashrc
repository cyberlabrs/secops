# ~/.bashrc za DevSecOps lab
[ -f /etc/bash_completion ] && . /etc/bash_completion
export PS1='\[\e[1;32m\]\u@devsecops\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
export EDITOR=vim
alias ll='ls -la'
alias gcl='gitlab-ci-local'
