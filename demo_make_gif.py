from PIL import Image
paths = ['e:/smart hack challange/HYDROSENTINAL/demo-frame-1.png', 'e:/smart hack challange/HYDROSENTINAL/demo-frame-2.png', 'e:/smart hack challange/HYDROSENTINAL/demo-frame-3.png']
imgs = [Image.open(p).convert('RGBA') for p in paths]
minw = min(img.width for img in imgs)
minh = min(img.height for img in imgs)
imgs = [img.resize((minw, minh), Image.LANCZOS) for img in imgs]
imgs[0].save('e:/smart hack challange/HYDROSENTINAL/demo-command-center.gif', save_all=True, append_images=imgs[1:], duration=800, loop=0, disposal=2)
print('GIF created at e:/smart hack challange/HYDROSENTINAL/demo-command-center.gif')
