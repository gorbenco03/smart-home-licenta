#!/bin/zsh
# Generează placeholdere PDF (dreptunghi „de înlocuit") pentru fiecare figură.
set -e
cd "$(dirname "$0")/.."
OUT=pics
TMP=$(mktemp -d)

names=(
  fig-arhitectura
  fig-usecase
  fig-flux-date
  fig-er
  fig-secventa-monitorizare
  fig-secventa-comanda
  fig-secventa-alerta
  fig-ml-pipeline
  fig-ml-isolation
  fig-piramida-testare
  fig-eval-anomalii
  fig-pinout
  fig-mobile
)

for n in $names; do
  cat > "$TMP/$n.tex" <<EOF
\documentclass[border=0pt]{standalone}
\usepackage{fontspec}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
  \draw[dashed, line width=1pt, color=gray] (0,0) rectangle (14,9);
  \node[align=center, gray] at (7,5.2) {\Huge DE \^INLOCUIT};
  \node[align=center, gray] at (7,3.6) {\Large \texttt{$n.pdf}};
\end{tikzpicture}
\end{document}
EOF
  ( cd "$TMP" && xelatex -interaction=nonstopmode "$n.tex" >/dev/null 2>&1 )
  cp "$TMP/$n.pdf" "$OUT/$n.pdf"
  echo "  generat $OUT/$n.pdf"
done

rm -rf "$TMP"
echo "Gata: ${#names[@]} placeholdere."
