#!/bin/bash
shopt -s nullglob

i=1
for file in *.gif; do
    # Verifica que sea un archivo real antes de operar
    [ -f "$file" ] || continue
    
    # mv -n impide que un archivo sobrescriba a otro
    mv -n -- "$file" "pre_${i}.gif"
    
    # Aritmética POSIX para máxima compatibilidad
    i=$((i + 1))
done
