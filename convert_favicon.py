from PIL import Image
import os

source_path = r'C:\Users\YesWe\Desktop\Dispensary Templates\p60-cannabis\image\storeFavicon.webp'
root_dir = r'C:\Users\YesWe\Desktop\Dispensary Templates\p60-cannabis'

try:
    img = Image.open(source_path).convert('RGBA')
    
    # 1. Update app/favicon.ico
    icon_sizes = [(16,16), (32, 32), (48, 48), (64,64)]
    img.save(os.path.join(root_dir, 'app', 'favicon.ico'), format='ICO', sizes=icon_sizes)
    print("app/favicon.ico updated successfully!")
    
    # 2. Update root favicon.ico
    img.save(os.path.join(root_dir, 'favicon.ico'), format='ICO', sizes=icon_sizes)
    print("root favicon.ico updated successfully!")
    
    # 3. Update root favicon png files
    png_sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]
    for size in png_sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(root_dir, f'favicon-{size}x{size}.png'), format='PNG')
        print(f"favicon-{size}x{size}.png updated!")
        
    # 4. Update root favicon-256x256.webp
    resized_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    resized_256.save(os.path.join(root_dir, 'favicon-256x256.webp'), format='WEBP')
    print("favicon-256x256.webp updated!")
    
    # 5. Update app/apple-icon.png
    resized_180 = img.resize((180, 180), Image.Resampling.LANCZOS)
    resized_180.save(os.path.join(root_dir, 'app', 'apple-icon.png'), format='PNG')
    print("app/apple-icon.png updated successfully!")
    
    # 6. Copy source WebP as after_dark_favicon.webp in banners too, just in case any banner code references it!
    img.save(os.path.join(root_dir, 'public', 'banners', 'after_dark_favicon.webp'), format='WEBP')
    print("public/banners/after_dark_favicon.webp updated!")

except Exception as e:
    print(f"Error: {e}")
