from pathlib import Path
import re
path = Path('src/pages/PremiumShowcase.tsx')
text = path.read_text(encoding='utf-8')
classes = re.findall(r'className="([^"]*)"', text)
words = set()
for c in classes:
    words.update(c.split())
custom = sorted({tok for tok in words if tok.startswith(('bg-','text-','border-','from-','placeholder:'))})
print('\n'.join(custom))
print('---')
print(len(custom))
