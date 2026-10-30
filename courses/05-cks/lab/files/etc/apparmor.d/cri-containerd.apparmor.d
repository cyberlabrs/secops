# Podrazumijevani AppArmor profil za kontejnere (RuntimeDefault), po uzoru na containerd-ov.
# Učitava se prije containerd-a: containerd tada koristi ovaj profil umjesto da generiše svoj,
# jer Debianov apparmor_parser 3.0 sa novijim kernelom bez pravila "unix," blokira unix sockete.
abi <abi/3.0>,
#include <tunables/global>

profile cri-containerd.apparmor.d flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  network,
  unix,
  capability,
  file,
  umount,
  ptrace (trace,read,tracedby,readby) peer=cri-containerd.apparmor.d,
  signal (receive) peer=unconfined,
  signal (send,receive) peer=cri-containerd.apparmor.d,

  deny @{PROC}/* w,
  deny @{PROC}/{[^1-9],[^1-9][^0-9],[^1-9s][^0-9y][^0-9s],[^1-9][^0-9][^0-9][^0-9/]*}/** w,
  deny @{PROC}/sys/[^k]** w,
  deny @{PROC}/sys/kernel/{?,??,[^s][^h][^m]**} w,
  deny @{PROC}/sysrq-trigger rwklx,
  deny @{PROC}/kcore rwklx,
  deny mount,
  deny /sys/[^f]*/** wklx,
  deny /sys/f[^s]*/** wklx,
  deny /sys/fs/[^c]*/** wklx,
  deny /sys/fs/c[^g]*/** wklx,
  deny /sys/fs/cg[^r]*/** wklx,
  deny /sys/firmware/** rwklx,
  deny /sys/kernel/security/** rwklx,
}
