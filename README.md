# Firewall Simulator

Een interactieve webtool waarmee studenten leren hoe een stateful firewall werkt:
je bouwt een netwerk, schrijft firewallregels en test daarna of het verkeer er
doorkomt of niet.

**Probeer het uit:** [graduaatiot.be/firewall](https://www.graduaatiot.be/firewall/)


---

## Waarom deze tool bestaat

In het vak Networking Advanced configureren onze studenten firewalls op echte
MikroTik-routers. Dat werkt, maar het labo heeft twee nadelen: je hebt hardware
nodig, en een fout kost al snel een kwartier om terug te vinden. Bovendien zie je
nooit *waarom* een pakket geblokkeerd wordt. Je ziet alleen dat de ping mislukt.

Deze simulator maakt dat zichtbaar. Je stuurt een pakket door je eigen regels en
de tool toont regel per regel wat er gebeurt: welke regels bekeken worden, waarom
ze niet matchen, en welke regel uiteindelijk beslist. Zo wordt het abstracte
principe "van boven naar beneden, de eerste regel die matcht wint" iets dat je
letterlijk ziet gebeuren.

## Voor wie

- **Studenten** Graduaat Internet of Things (Howest), vak Networking Advanced.
- **Docenten** die firewalling doceren en op zoek zijn naar een oefenomgeving
  zonder hardware. De tool is vrij te gebruiken en aan te passen.
- Iedereen die wil begrijpen wat "stateful" nu eigenlijk betekent.

Er is geen account nodig en er wordt niets opgeslagen op een server. Alles draait
in je browser.

## Hoe het werkt

De tool loodst je door drie stappen.

**1. Netwerk opbouwen.** Je vertrekt van een router en voegt er een
internetverbinding, VLAN's en hosts aan toe. Het resultaat is een schema dat je
ook als tekening van je netwerk kan gebruiken.

**2. Firewallregels schrijven.** Je kiest eerst je strategie: alles toestaan
tenzij geblokkeerd, of alles blokkeren tenzij toegestaan. Daarna schrijf je
regels met een bron, een bestemming, een soort verkeer en een actie. De volgorde
bepaalt alles, dus je kan regels verslepen of met de pijltjes verschuiven.

**3. Simuleren.** Je kiest een afzender en een bestemming en stuurt een pakket.
De tool toont de volledige evaluatie, ook van het antwoordpakket op de terugweg,
en het eindoordeel: toegestaan of geblokkeerd.

Je regels kan je exporteren naar RouterOS-configuratie, zodat je ze in het labo
kan vergelijken met wat je op de MikroTik intikt.

**Oefenscenario's.** In plaats van zelf een netwerk te bouwen kan je een scenario
inladen: het netwerk staat klaar en je krijgt een opdracht met eisen. Een zelftest
toont live welke eisen je regels al halen, en wijst op regels die nooit kunnen
matchen. Docenten kunnen met de wizard zelf scenario's opbouwen.

## Status

Dit is lesmateriaal in ontwikkeling, geen afgewerkt product. Wat er intussen
in zit:

- stateful evaluatie: het antwoordpakket wordt apart geëvalueerd, met een
  zichtbare connectietabel, zodat established en related verkeer kloppen
- IP-adressen en subnetten op VLAN's en hosts, ook in de RouterOS-export
- de chains `forward` en `input`: kies de router als bestemming om te oefenen
  op wie de router zelf mag beheren
- oefenscenario's met een zelftest, en een wizard om er zelf te maken
- automatische feedback op je ruleset

Bugmeldingen en suggesties zijn welkom via de
[issues](../../issues).

## Zelf draaien

```bash
git clone https://github.com/frederiekberthier/firewall-explorer.git
cd firewall-explorer
npm install
npm run dev
```

De app draait daarna op `http://localhost:8080/firewall/`. Is poort 8080 al in
gebruik, dan kiest Vite de volgende vrije poort; het juiste adres staat in de
terminal.

Tests draaien en bouwen voor productie:

```bash
npm test           # unit- en componenttests (Vitest)
npm run build      # output in dist/
```

Gebouwd met Vite, React, TypeScript, Tailwind CSS en shadcn/ui.

## Meedoen

Suggesties voor nieuwe oefenscenario's zijn het meest welkom. Een goed scenario
beschrijft een herkenbare situatie (een kantoor met camerabewaking, een
co-workingspace met gastennetwerk, een magazijn met robots) en een reeks eisen
waaraan de firewall moet voldoen.

## Licentie en gebruik

CC BY-NC-SA 4.0 (delen en aanpassen mag, niet commercieel, zelfde licentie)

Gemaakt voor de opleiding [Graduaat Internet of
Things](https://www.howest.be/iot) aan Howest. Vrij te gebruiken in andere
opleidingen; een vermelding wordt geapprecieerd.
