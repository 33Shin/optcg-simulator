# Card Image Assets - File List and Download Instructions

## All Required Card Images (31 unique files)

### Luffy Deck Cards (15 unique)
| File Name | Set | Card Name |
|---|---|---|
| OP11-040_EN.webp | OP11 | Monkey.D.Luffy (Leader) |
| OP13-043_EN.webp | OP13 | Otama |
| OP05-067_EN.webp | OP05 | Zoro-Juurou |
| ST18-001_EN.webp | ST18 | Uso-Hachi |
| EB01-061_EN.webp | EB01 | Mr.2.Bon.Kurei(Bentham) |
| OP06-047_EN.webp | OP06 | Charlotte Pudding |
| OP11-054_EN.webp | OP11 | Nami |
| EB03-034_EN.webp | EB03 | Charlotte Linlin |
| P-107_EN.webp | P | Gol.D.Roger |
| OP01-070_EN.webp | OP01 | Dracule Mihawk |
| OP06-119_EN.webp | OP06 | Sanji |
| OP09-078_EN.webp | OP09 | Gum-Gum Giant |
| OP11-080_EN.webp | OP11 | Gear Two |
| OP08-076_EN.webp | OP08 | It's to Die For |
| OP04-056_EN.webp | OP04 | Gum-Gum Red Roc |

### Nami Deck Cards (18 unique, includes 2 overlap: OP06-047, OP04-056)
| File Name | Set | Card Name |
|---|---|---|
| OP11-041_EN.webp | OP11 | Nami (Leader) |
| OP14-102_EN.webp | OP14 | Kumacy |
| P-096_EN.webp | P | Girl |
| OP03-048_EN.webp | OP03 | Nojiko |
| OP06-106_EN.webp | OP06 | Kouzuki Hiyori |
| OP06-104_EN.webp | OP06 | Kikunojo |
| OP12-112_EN.webp | OP12 | Baby 5 |
| OP14-110_EN.webp | OP14 | Dr. Hogback |
| OP14-111_EN.webp | OP14 | Perona |
| PRB02-008_EN.webp | PRB02 | Marco |
| EB03-053_EN.webp | EB03 | Nami |
| OP08-047_EN.webp | OP08 | Jozu |
| EB03-055_EN.webp | EB03 | Nico Robin |
| OP14-104_EN.webp | OP14 | Gecko Moria |
| EB03-060_EN.webp | EB03 | Will You Be My Servant? |
| OP06-058_EN.webp | OP06 | Gravity Blade Raging Tiger |

## Additional Assets Needed
- Game background texture (currently solid fill `#1a1a2e`)

## Download Method
Direct browser download fails due to CORS. Use one of these methods:

### Method 1: PowerShell with proper headers (recommended)
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0" }
Invoke-RestMethod -Method Head -Uri $url -Headers $headers
```
Then use curl or wget:
```powershell
curl.exe -L -o "OP11-040_EN.webp" "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP11/OP11-040_EN.webp"
```

### Method 2: Node.js script
```javascript
const https = require('https');
const fs = require('fs');
const url = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/SET/SET-ID_EN.webp';
https.get(url, (res) => {
  res.pipe(fs.createWriteStream('filename_EN.webp'));
});
```

### Method 3: wget (Linux/Mac)
```bash
wget "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/SET/SET-ID_EN.webp" -O "SET-ID_EN.webp"
```

## Download Script (curl batch)
Run in assets/imgs/ directory:
```powershell
$cards = @("OP11-040","OP11-041","OP13-043","OP05-067","ST18-001","EB01-061","OP06-047","OP11-054","EB03-034","P-107","OP01-070","OP06-119","OP09-078","OP11-080","OP08-076","OP04-056","OP14-102","P-096","OP03-048","OP06-106","OP06-104","OP12-112","OP14-110","OP14-111","PRB02-008","EB03-053","OP08-047","EB03-055","OP14-104","EB03-060","OP06-058")
foreach($card in $cards) {
  $set = $card.Substring(0, $card.IndexOf("-"))
  $set = if ($set -eq "P") { "P" } elseif ($set -eq "PRB02") { "$set" } else { "$set" }
  $url = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/$set/${card}_EN.webp"
  curl.exe -L -o "${card}_EN.webp" $url
}
```

## Downloads Complete
All 31 card images downloaded successfully to `public/assets/imgs/` (3.43 MB total).
- **Verified**: Every file is a valid .webp image (100+ KB each)
- **Path note**: Promo cards P-107 and P-096 use set path `"P"` (not `*P` or `*PCS1`)
- **DON!! token**: `don.png` and `don_back.png` already present in `public/assets/imgs/`
- **Card back**: `back.webp` already present in `public/assets/imgs/`
- **Vite note**: All static assets are in `public/` so Vite auto-copies them to `dist/` at build time

## Total Downloaded: 31 card images + 3 shared assets (back.webp, don.png, don_back.png)
