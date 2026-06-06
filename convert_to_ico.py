from PIL import Image

# 读取PNG图片
png_path = r"C:\Users\DELL\Desktop\鲸鱼.png"
ico_path = r"C:\Users\DELL\Desktop\鲸鱼.ico"

# 打开图片
img = Image.open(png_path)

# 转换为RGB模式（如果需要）
if img.mode in ('RGBA', 'LA', 'P'):
    # 对于有透明度的图片，先转换为RGB
    background = Image.new('RGB', img.size, (255, 255, 255))
    if img.mode == 'P':
        img = img.convert('RGBA')
    if img.mode == 'RGBA':
        background.paste(img, mask=img.split()[3])
    else:
        background.paste(img)
    img = background

# 保存为ICO格式（Windows图标）
# ICO格式支持多个尺寸，这里生成16x16, 32x32, 48x48, 256x256的图标
sizes = [16, 32, 48, 256]
img.save(ico_path, format='ICO', sizes=sizes)

print(f"转换完成！ICO文件已保存到: {ico_path}")
