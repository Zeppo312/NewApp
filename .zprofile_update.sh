#!/bin/bash
# NVM Setup für permanente Verfügbarkeit von Node.js

echo "# NVM Setup - Node Version Manager" >> ~/.zprofile
echo "export NVM_DIR=\"\$HOME/.nvm\"" >> ~/.zprofile
echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"  # This loads nvm" >> ~/.zprofile
echo "[ -s \"\$NVM_DIR/bash_completion\" ] && \\. \"\$NVM_DIR/bash_completion\"  # This loads nvm bash_completion" >> ~/.zprofile

echo "NVM Setup wurde zu ~/.zprofile hinzugefügt!"
echo "Bitte führe aus: source ~/.zprofile"
echo "Oder öffne ein neues Terminal-Fenster"
