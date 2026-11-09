#!/bin/bash
# Prepara un Droplet nuevo (Ubuntu 24.04) para Feline. Ejecutar UNA vez como root:
#   ssh root@<IP> 'bash -s' < scripts/deploy/bootstrap-droplet.sh
# Crea el usuario "deploy" (con tu misma clave SSH), firewall, swap, Docker, actualizaciones de seguridad
# automáticas y fail2ban, y desactiva el acceso SSH de root y con contraseña.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecútalo como root."; exit 1; }
[ -s /root/.ssh/authorized_keys ] || { echo "El Droplet no tiene clave SSH en root: créalo con una clave SSH."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl git ufw fail2ban unattended-upgrades

# Usuario de despliegue con la misma clave SSH que root
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys

# Swap de 2 GB: margen para compilar la imagen en un Droplet de 2 GB
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
fi

# Docker oficial
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker deploy
# Rotación de logs de los contenedores
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
JSON
systemctl restart docker

# Firewall: solo SSH, HTTP y HTTPS
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# SSH solo con clave y sin root
cat > /etc/ssh/sshd_config.d/99-feline.conf <<'SSHD'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
SSHD
systemctl reload ssh

# Actualizaciones de seguridad automáticas
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban

timedatectl set-timezone America/Santiago
echo
echo "Listo. Desde ahora entra como: ssh deploy@<IP>"
echo "Siguiente paso: docs/DESPLIEGUE.md §4 (clonar el repositorio)."
