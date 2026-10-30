# podešavanja kao na CKA ispitu: alias k, dovršavanje komandi i korisne varijable
export KUBECONFIG=/root/.kube/config
export EDITOR=vim
alias k=kubectl
complete -o default -F __start_kubectl k 2>/dev/null
export do="--dry-run=client -o yaml"
export now="--force --grace-period 0"
PS1='\[\e[1;32m\]\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]$ '
