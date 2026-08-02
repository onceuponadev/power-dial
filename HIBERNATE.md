# Enable Hibernate on Linux

This guide covers enabling hibernation across common Linux distributions and filesystem configurations.

> **Warning:** This guide involves modifying kernel boot parameters, initramfs, and disk configuration. Incorrect settings can prevent your system from booting properly. The existence of this guide does not encourage you to follow it — hibernate is an advanced feature that most users don't need. However, if you are persistent in wanting hibernate enabled, proceed with caution. Always have a live USB or recovery kernel available as a fallback.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Check Current Status](#check-current-status)
- [Step 1: Create Swap Space](#step-1-create-swap-space)
  - [Option A: Swap File](#option-a-swap-file-recommended)
  - [Option B: Swap Partition](#option-b-swap-partition)
- [Step 2: Make Swap Persistent (fstab)](#step-2-make-swap-persistent-fstab)
- [Step 3: Configure Kernel Resume Parameter](#step-3-configure-kernel-resume-parameter)
  - [Find Resume Device and Offset](#find-resume-device-and-offset)
  - [Apply Kernel Parameters](#apply-kernel-parameters)
- [Step 4: Allow Hibernate in Polkit](#step-4-allow-hibernate-in-polkit-if-needed)
- [Step 5: SELinux (Fedora/RHEL only)](#step-5-selinux-fedorarhel-only)
- [Step 6: Reboot and Verify](#step-6-reboot-and-verify)
- [Troubleshooting](#troubleshooting)
- [Reverting Hibernate Setup](#reverting-hibernate-setup)
  - [Fedora / RHEL](#revert-fedora--rhel)
  - [Ubuntu / Debian](#revert-ubuntu--debian)
  - [Arch Linux](#revert-arch-linux)
  - [openSUSE](#revert-opensuse)
  - [Pop!_OS / systemd-boot](#revert-pop_os--systemd-boot)

---

## Prerequisites

- Recommended: swap size at least equal to installed RAM (e.g., 16GB RAM → 16GB+ swap)
- Swap must be on **persistent storage** (disk/SSD), not zram
- Kernel must know where to resume from (bootloader configuration)

> **Scope:** This guide covers plaintext swap only. LUKS-encrypted swap requires a different `resume=` target (the `/dev/mapper/...` device) plus a matching `/etc/crypttab` entry, and is not covered here.

## Check Current Status

```bash
# Check if hibernate is already supported (requires polkit agent — may fail from plain terminal)
busctl call org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager CanHibernate
# "yes" or "challenge" = supported
# "na" = not available
# "Access denied" = polkit or SELinux blocking the check, not necessarily unsupported

# More reliable check from terminal:
systemctl hibernate --check-inhibitors=no --dry-run
# Exit code 0 = system can hibernate

# Check current swap
swapon --show
free -h | grep Swap

# Check RAM size (swap should be >= this)
free -h | grep Mem

# Check filesystem type
df -T /
```

## Step 1: Create Swap Space

### Option A: Swap File (Recommended)

#### ext4 / xfs

```bash
# Create swap file (replace 16G with your RAM size or larger)
sudo fallocate -l 16G /swapfile

# Set permissions
sudo chmod 600 /swapfile

# Format as swap
sudo mkswap /swapfile

# Enable immediately
sudo swapon /swapfile

# Verify
swapon --show
```

#### btrfs (Fedora, openSUSE, etc.)

btrfs requires a special command — `fallocate` does NOT work.

```bash
# Create swap file with btrfs-specific command
sudo btrfs filesystem mkswapfile --size 16G /swap/swapfile

# If the above fails, use the manual method:
sudo mkdir -p /swap
sudo truncate -s 0 /swap/swapfile
sudo chattr +C /swap/swapfile
sudo fallocate -l 16G /swap/swapfile
sudo chmod 600 /swap/swapfile
sudo mkswap /swap/swapfile

# Enable immediately
sudo swapon /swap/swapfile

# Verify
swapon --show
```

> **Note:** On btrfs, the swap file must be on a non-snapshotted subvolume and must have the NOCOW attribute (`+C`). Avoid operations that relocate the swapfile's extents (such as `btrfs balance`). If the swapfile is recreated or relocated, recalculate `resume_offset` (see [Step 3](#step-3-configure-kernel-resume-parameter)).

#### zfs

> **Current OpenZFS on Linux does not support hibernation from zvol-backed swap.** Resuming from a zvol-backed swap device doesn't just fail — the resume attempt corrupts the zpool. If you're on ZFS and want hibernate, **skip this subsection** and use [Option B: Swap Partition](#option-b-swap-partition) instead (a plain partition living outside ZFS). The steps below are for ordinary paging swap only, not for hibernation.

ZFS doesn't support swap files at all — a zvol is the only ZFS-native swap option, and even that's for paging, not resume.

```bash
# Create a zvol for swap (NOT suitable for hibernate resume — see warning above)
sudo zfs create -V 16G -b $(getconf PAGESIZE) \
  -o compression=zle \
  -o logbias=throughput \
  -o sync=always \
  -o primarycache=metadata \
  -o secondarycache=none \
  rpool/swap

# Format and enable
sudo mkswap /dev/zvol/rpool/swap
sudo swapon /dev/zvol/rpool/swap
```

### Option B: Swap Partition

If you have unallocated space or can shrink an existing partition:

```bash
# Create partition with fdisk/gdisk/parted (example with parted)
sudo parted /dev/nvme0n1 mkpart primary linux-swap 100GB 116GB

# If /dev/nvme0n1pX doesn't show up yet, refresh the kernel's partition table view:
sudo partprobe /dev/nvme0n1

# Format as swap (replace with your partition)
sudo mkswap /dev/nvme0n1pX

# Enable
sudo swapon /dev/nvme0n1pX

# Verify
swapon --show
```

## Step 2: Make Swap Persistent (fstab)

### Swap File

```bash
# Add to /etc/fstab
# For ext4/xfs:
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# For btrfs:
echo '/swap/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Swap Partition

```bash
# Get UUID of swap partition
sudo blkid /dev/nvme0n1pX

# Add to /etc/fstab
echo 'UUID=<your-uuid> none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Step 3: Configure Kernel Resume Parameter

The kernel needs to know where to find the hibernation image on boot.

### Find Resume Device and Offset

#### Swap Partition

```bash
# The resume device is the partition itself
# Example: resume=/dev/nvme0n1p3 or resume=UUID=<uuid>
sudo blkid /dev/nvme0n1pX
```

No offset needed for partitions.

#### Swap File (ext4/xfs)

```bash
# Find the physical offset
sudo filefrag -v /swapfile | head -4
# Look for the first "physical_offset" value in the output
# Example output: "0: 0..32767: 2048..34815" → offset is 2048
```

#### Swap File (btrfs)

```bash
# btrfs requires btrfs_map_physical or the newer method
# Method 1: Using btrfs inspect-internal (kernel 6.1+)
sudo btrfs inspect-internal map-swapfile -r /swap/swapfile
# This outputs the resume offset directly

# Method 2: Using btrfs_map_physical (older kernels)
# Download and compile btrfs_map_physical.c, then:
# sudo ./btrfs_map_physical /swap/swapfile | head -2
# Take the physical offset from the last column, divide by page size:
# offset = physical_offset / $(getconf PAGESIZE)
```

### Find Resume Device (for swap files)

```bash
# The resume device is the partition containing the swap file
findmnt -no SOURCE -T /swapfile
sudo blkid <device>
# or for btrfs:
findmnt -no SOURCE -T /swap/swapfile
sudo blkid <device>
```

### Apply Kernel Parameters

#### Fedora (GRUB2 + dracut)

```bash
# Edit kernel command line
sudo grubby --update-kernel=ALL --args="resume=UUID=<device-uuid> resume_offset=<offset>"

# Rebuild initramfs to include resume module
sudo dracut --force --add resume

# Verify (after reboot)
cat /proc/cmdline
```

#### Ubuntu / Debian (GRUB2 + initramfs-tools)

```bash
# Edit /etc/default/grub
sudo nano /etc/default/grub
# Add to GRUB_CMDLINE_LINUX_DEFAULT:
# "resume=UUID=<device-uuid> resume_offset=<offset>"

# Update GRUB
sudo update-grub

# Add resume to initramfs config
printf 'RESUME=UUID=<device-uuid>\nresume_offset=<offset>\n' | sudo tee /etc/initramfs-tools/conf.d/resume

# Rebuild initramfs
sudo update-initramfs -u
```

#### Arch Linux (GRUB/systemd-boot + mkinitcpio)

```bash
# For GRUB: edit /etc/default/grub same as Ubuntu

# For systemd-boot: edit /boot/loader/entries/*.conf
# Add: options ... resume=UUID=<device-uuid> resume_offset=<offset>

# Ensure the "resume" hook is present in /etc/mkinitcpio.conf
# HOOKS=(... resume ...)
# Follow the Arch Wiki's recommended hook ordering for your initramfs type
# (busybox vs systemd)

# Rebuild initramfs
sudo mkinitcpio -P

# Update bootloader (if GRUB)
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

#### openSUSE (GRUB2 + dracut)

```bash
# Use YaST or manually:
sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="resume=UUID=<device-uuid> resume_offset=<offset> /' /etc/default/grub

# Rebuild GRUB
sudo grub2-mkconfig -o /boot/grub2/grub.cfg

# Rebuild initramfs
sudo dracut --force
```

#### systemd-boot (Pop!_OS, some Arch setups)

Both use systemd-boot as the bootloader, but they build the initrd differently — treat them separately.

**Pop!_OS** (kernelstub + initramfs-tools):

```bash
# kernelstub manages the boot entry — don't hand-edit the .conf file directly
sudo kernelstub -a "resume=UUID=<device-uuid>"
sudo kernelstub -a "resume_offset=<offset>"

# Still initramfs-tools under the hood — this step is required:
printf 'RESUME=UUID=<device-uuid>\nresume_offset=<offset>\n' | sudo tee /etc/initramfs-tools/conf.d/resume
sudo update-initramfs -u
```

**dracut built with the systemd module** (some Arch systemd-boot setups):

```bash
# Edit the boot entry
sudo nano /boot/loader/entries/*.conf

# Add to options line:
# resume=UUID=<device-uuid> resume_offset=<offset>

# No initramfs rebuild needed — systemd-hibernate-resume-generator
# reads resume= from the kernel cmdline at boot.
```

## Step 4: Allow Hibernate in Polkit (if needed)

Most modern distributions already ship working hibernate policies. Only perform this step if `CanHibernate` succeeds but authorization is still denied.

```bash
# Check if polkit blocks it
pkaction --verbose --action-id org.freedesktop.login1.hibernate

# If blocked, create an override:
sudo tee /etc/polkit-1/rules.d/10-enable-hibernate.rules << 'EOF'
polkit.addRule(function(action, subject) {
    if (action.id == "org.freedesktop.login1.hibernate" ||
        action.id == "org.freedesktop.login1.hibernate-multiple-sessions") {
        return polkit.Result.YES;
    }
});
EOF
```

> **Pop!_OS / some Ubuntu-derived systems:** If the rule above doesn't take effect, your system may still be reading the older `.pkla` local-authority format instead of JS rules. Use this instead:
>
> ```bash
> sudo mkdir -p /etc/polkit-1/localauthority/10-vendor.d
> sudo tee /etc/polkit-1/localauthority/10-vendor.d/10-enable-hibernate.pkla << 'EOF'
> [Enable hibernate in logind]
> Identity=unix-user:*
> Action=org.freedesktop.login1.hibernate;org.freedesktop.login1.hibernate-multiple-sessions
> ResultActive=yes
> EOF
> ```

## Step 5: SELinux (Fedora/RHEL only)

If SELinux is enabled, you **must** set the correct file context on the swap file. Without this, `systemd-logind` cannot read the swap file and hibernate will fail with a generic "Access denied" error — with no indication that SELinux is the cause.

> **Note:** `semanage` is provided by the `policycoreutils-python-utils` package. Install it first if the command is not found: `sudo dnf install policycoreutils-python-utils`

```bash
# For swap file at /swap/swapfile
sudo semanage fcontext -a -t swapfile_t "/swap/swapfile"
sudo restorecon -v /swap/swapfile

# Verify the context was applied
ls -Z /swap/swapfile
# Should show: ... swapfile_t ...
```

> **Do this before rebooting or testing hibernate.** If you already rebooted and get "Access denied", check `sudo ausearch -m AVC --since recent | grep swapfile` to confirm SELinux is the cause.

## Step 6: Reboot and Verify

```bash
# Reboot to apply kernel parameters
sudo reboot

# After reboot, verify kernel params are active:
cat /proc/cmdline | grep resume

# Verify swap is active:
swapon --show

# Test if hibernate is possible (reliable method):
systemctl hibernate --check-inhibitors=no --dry-run
# Exit code 0 = ready to hibernate

# If the above succeeds, test actual hibernate:
systemctl hibernate
```

> **If you get "Access denied":** Check SELinux audit logs with `sudo ausearch -m AVC --since recent | grep swap`. If you see a denial for `systemd-logind` reading the swapfile, you missed [Step 5](#step-5-selinux-fedorarhel-only).

## Troubleshooting

### "Not enough swap space"
- Swap should be >= RAM. Check with `free -h`.

### "No suitable swap space"
- zram doesn't count. Need disk-based swap.
- On btrfs, swap file must have NOCOW attribute.

### Hibernate succeeds but doesn't resume
- Kernel `resume=` parameter is wrong or missing.
- Check `/proc/cmdline` after boot.
- For swap files, `resume_offset` must be correct.

### "Operation not permitted" / "Access denied"
- **SELinux (most common on Fedora):** logind can't read the swap file. Run `sudo ausearch -m AVC --since recent | grep swap` — if you see a denial, fix the context with [Step 5](#step-5-selinux-fedorarhel-only).
- Polkit is blocking it. See [Step 4](#step-4-allow-hibernate-in-polkit-if-needed).
- `busctl call CanHibernate` may show "Access denied" even when hibernate works — this is a D-Bus authentication issue from the terminal. Use `systemctl hibernate --dry-run` instead.

### System hangs on resume
- `resume_offset` is incorrect. Boot with a previous kernel or rescue mode.
- Remove `resume` and `resume_offset` from kernel cmdline to recover.

### Hibernate worked before but not anymore
- `resume_offset` is only valid until the swapfile's physical location changes. If you resized or recreated the swapfile, or (on btrfs) ran a `balance` that touched it, recompute the offset ([Step 3](#find-resume-device-and-offset)) and update the kernel parameter. ext4/xfs swapfiles don't relocate under normal use, so this mainly hits btrfs or any recreated swapfile.

## Reverting Hibernate Setup

### Revert: Fedora / RHEL

```bash
# Remove kernel parameters
sudo grubby --update-kernel=ALL --remove-args="resume resume_offset"

# Rebuild initramfs
sudo dracut --force

# Disable and remove swap
sudo swapoff /swap/swapfile  # or /swapfile or partition
sudo rm /swap/swapfile

# Remove fstab entry
sudo sed -i '/swapfile/d' /etc/fstab  # or edit manually

# Remove polkit rule (if created)
sudo rm -f /etc/polkit-1/rules.d/10-enable-hibernate.rules
sudo rm -f /etc/polkit-1/localauthority/10-vendor.d/10-enable-hibernate.pkla

# Remove SELinux context (if set)
sudo semanage fcontext -d "/swap/swapfile" 2>/dev/null

# Reboot
sudo reboot
```

### Revert: Ubuntu / Debian

```bash
# Remove resume from GRUB
sudo nano /etc/default/grub
# Remove "resume=..." and "resume_offset=..." from GRUB_CMDLINE_LINUX_DEFAULT
sudo update-grub

# Remove resume from initramfs config
sudo rm -f /etc/initramfs-tools/conf.d/resume
sudo update-initramfs -u

# Disable and remove swap
sudo swapoff /swapfile
sudo rm /swapfile

# Remove fstab entry
sudo sed -i '/swapfile/d' /etc/fstab  # or edit manually

# Remove polkit rule (if created)
sudo rm -f /etc/polkit-1/rules.d/10-enable-hibernate.rules
sudo rm -f /etc/polkit-1/localauthority/10-vendor.d/10-enable-hibernate.pkla

# Reboot
sudo reboot
```

### Revert: Arch Linux

```bash
# For GRUB:
sudo nano /etc/default/grub
# Remove "resume=..." and "resume_offset=..." from GRUB_CMDLINE_LINUX_DEFAULT
sudo grub-mkconfig -o /boot/grub/grub.cfg

# For systemd-boot:
sudo nano /boot/loader/entries/*.conf
# Remove "resume=..." and "resume_offset=..." from options line

# Remove "resume" hook from /etc/mkinitcpio.conf
sudo nano /etc/mkinitcpio.conf
# Remove "resume" from HOOKS=(...)
sudo mkinitcpio -P

# Disable and remove swap
sudo swapoff /swapfile
sudo rm /swapfile

# Remove fstab entry
sudo sed -i '/swapfile/d' /etc/fstab  # or edit manually

# Remove polkit rule (if created)
sudo rm -f /etc/polkit-1/rules.d/10-enable-hibernate.rules
sudo rm -f /etc/polkit-1/localauthority/10-vendor.d/10-enable-hibernate.pkla

# Reboot
sudo reboot
```

### Revert: openSUSE

```bash
# Remove resume from GRUB
sudo nano /etc/default/grub
# Remove "resume=..." and "resume_offset=..." from GRUB_CMDLINE_LINUX_DEFAULT
sudo grub2-mkconfig -o /boot/grub2/grub.cfg

# Rebuild initramfs
sudo dracut --force

# Disable and remove swap
sudo swapoff /swap/swapfile
sudo rm /swap/swapfile

# Remove fstab entry
sudo sed -i '/swapfile/d' /etc/fstab  # or edit manually

# Remove polkit rule (if created)
sudo rm -f /etc/polkit-1/rules.d/10-enable-hibernate.rules
sudo rm -f /etc/polkit-1/localauthority/10-vendor.d/10-enable-hibernate.pkla

# Reboot
sudo reboot
```

### Revert: Pop!_OS / systemd-boot

```bash
# Remove kernel parameters (use the exact values you added)
sudo kernelstub -o "resume=UUID=<device-uuid>"
sudo kernelstub -o "resume_offset=<offset>"

# Remove resume from initramfs config
sudo rm -f /etc/initramfs-tools/conf.d/resume
sudo update-initramfs -u

# Disable and remove swap
sudo swapoff /swapfile
sudo rm /swapfile

# Remove fstab entry
sudo sed -i '/swapfile/d' /etc/fstab  # or edit manually

# Remove polkit rule (if created)
sudo rm -f /etc/polkit-1/rules.d/10-enable-hibernate.rules
sudo rm -f /etc/polkit-1/localauthority/10-vendor.d/10-enable-hibernate.pkla

# Reboot
sudo reboot
```

> If you set up the dracut-with-systemd-module variant (some Arch setups) instead of Pop!_OS, use the [Arch revert](#revert-arch-linux) steps above (edit the loader entry directly, no kernelstub involved).
