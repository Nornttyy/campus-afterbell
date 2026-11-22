"""Bake seamless, metre-scale school materials. Input seed and palette are fixed."""
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

DEST = Path(__file__).resolve().parents[1] / 'dist/assets/materials'
rng = random.Random(911122)


def periodic_noise(size, cols, rows):
    grid = [[rng.randrange(256) for _ in range(cols)] for _ in range(rows)]
    seed = Image.new('L', (cols + 4, rows + 4))
    seed.putdata([grid[(y-2) % rows][(x-2) % cols] for y in range(rows+4) for x in range(cols+4)])
    return seed.resize(size, Image.Resampling.BICUBIC, box=(2, 2, cols+2, rows+2))


def base(size, fine, dark, light):
    coarse = periodic_noise(size, 8, 8)
    fine_detail = periodic_noise(size, *fine)
    return ImageOps.colorize(Image.blend(coarse, fine_detail, .60), dark, light)


def save(im, name, quality=85):
    im.save(DEST / (name+'91.webp'), quality=quality, method=6)


def polygon(draw, points, fill, w, h):
    # Duplicate only the pieces that cross the texture border.
    xs, ys = zip(*points)
    dxs = [0] + ([w] if min(xs)<0 else []) + ([-w] if max(xs)>=w else [])
    dys = [0] + ([h] if min(ys)<0 else []) + ([-h] if max(ys)>=h else [])
    for dx in dxs:
        for dy in dys:
            draw.polygon([(x+dx,y+dy) for x,y in points], fill=fill)


def terrazzo():
    size = 768
    im = base((size,size), (175,175), '#a49f95', '#bdb9af')
    d = ImageDraw.Draw(im, 'RGBA')
    palette = ['#d8d4c8','#cac6b9','#c4b99f','#a39b88','#8e9188','#b5b2a8','#888678','#686d66']
    for count, lo, hi in [(11500,.4,1.75),(1800,1.2,3.6),(720,2.6,7),(42,6,11)]:
        for k in range(count):
            x,y = rng.random()*size,rng.random()*size
            r = rng.uniform(lo,hi); stretch=rng.uniform(.35,.95); angle=rng.random()*math.tau
            pts=[]; n=rng.choice([3,4,4,5,6])
            for i in range(n):
                a=(i+rng.uniform(-.15,.15))*math.tau/n; rr=r*rng.uniform(.65,1)
                dx,dy=rr*math.cos(a),rr*math.sin(a)*stretch
                pts.append((x+dx*math.cos(angle)-dy*math.sin(angle),y+dx*math.sin(angle)+dy*math.cos(angle)))
            color=rng.choices(palette,weights=[19,17,10,11,8,14,7,3])[0]
            polygon(d,pts,color,size,size)
    save(im,'classroom-aggregate',88)


def veneer():
    w,h=768,384
    fibers=periodic_noise((w,h),8,175)
    slow=periodic_noise((w,h),5,18)
    data=[]; fp=fibers.load(); sp=slow.load()
    for y in range(h):
        for x in range(w):
            u=x/w; v=y/h; bend=.018*math.sin(math.tau*u+1.2)+.009*math.sin(2*math.tau*u+.4)
            ring=.5+.5*math.cos(math.tau*(13*v+bend*math.sin(math.tau*v)*13+.84*math.sin(math.tau*u)*math.cos(math.tau*v)))
            v0=(fp[x,y]-128)*.052+(sp[x,y]-128)*.041-4.6*ring**6
            data.append((round(215+v0),round(161+v0*1.12),round(75+v0*.90)))
    im=Image.new('RGB',(w,h));im.putdata(data);save(im,'maple-veneer',86)


def turf():
    size=640
    im=base((size,size),(47,48),'#596e26','#80903b')
    d=ImageDraw.Draw(im,'RGBA')
    for k in range(105000):
        x,y=rng.random()*size,rng.random()*size
        h=rng.uniform(1.4,7.0);lean=rng.uniform(-2.4,2.4)+1.45*math.sin(y*math.tau/size)
        col=rng.choice([(50,72,24,80),(157,165,74,86),(143,152,47,82),(52,85,23,90)])
        polygon(d,[(x-.65,y),(x+.75,y+.6),(x+lean,y-h)],col,size,size)
    save(im,'field-turf',84)


def running_track():
    size=384;im=base((size,size),(137,135),'#9e4937','#b95c47');d=ImageDraw.Draw(im,'RGBA')
    colors=[(112,53,43,160),(202,112,90,180),(141,65,52,185),(191,87,66,160),(219,134,106,155)]
    for _ in range(26000):
        x,y=rng.randrange(size),rng.randrange(size);r=rng.uniform(.4,2.5)
        polygon(d,[(x,y),(x+r,y+.35),(x+r*.8,y+r*.8),(x-.35,y+r*.7)],rng.choice(colors),size,size)
    save(im,'track-granules',85)


def upholstery():
    w=h=384;im=base((w,h),(40,43),'#a04a23','#c06732');d=ImageDraw.Draw(im,'RGBA')
    for y in range(0,h,3):
        d.line((0,y,w,y),fill=(71,33,19,34));d.line((0,y+1,w,y+1),fill=(250,177,106,32))
    for x in range(0,w,3):
        d.line((x,0,x,h),fill=(87,35,22,28))
    for y in range(0,h,12):
        for x in range((y//12%2)*6,w,12):
            d.line((x,y,x+2,y-2),fill=(240,175,117,75))
    save(im,'coach-upholstery',89)


def porcelain():
    s=512;step=s//4;im=base((s,s),(76,76),'#a7b3b8','#bac4c5');d=ImageDraw.Draw(im,'RGBA')
    for row in range(4):
        for col in range(4):
            x,y=col*step,row*step
            d.rectangle((x+2,y+2,x+step-2,y+step-2),fill=(71,91,105,rng.choice([4,7,13,16])))
            d.line((x,y,x+step-1,y),fill=(90,104,111,220),width=2);d.line((x,y,x,y+step-1),fill=(90,104,111,195),width=2)
            d.line((x+2,y+3,x+step-2,y+3),fill=(230,232,224,90));d.line((x+3,y+3,x+3,y+step-2),fill=(229,234,233,75))
    save(im,'washroom-tile',90)


def quilt():
    s=512;im=base((s,s),(97,96),'#b3b6ad','#cbc9bb');d=ImageDraw.Draw(im,'RGBA')
    for direction in range(2):
        for i in range(0,s,128):
            for off,width,color in [(7,42,(51,67,79,168)),(55,9,(68,71,68,120)),(77,6,(75,86,94,179)),(96,2,(126,91,70,115)),(112,4,(240,232,208,141))]:
                p=i+off;d.rectangle((p,0,p+width-1,s) if direction==0 else (0,p,s,p+width-1),fill=color)
    for i in range(0,s,3):
        d.line((i,0,i,s),fill=(236,228,212,33));d.line((0,i,s,i),fill=(31,41,52,38))
    save(im,'dorm-flannel',90)


def soup():
    size=512;im=base((size,size),(42,43),'#731410','#b83a1e');d=ImageDraw.Draw(im,'RGBA')
    for k in range(1040):
        x,y=rng.uniform(0,size),rng.uniform(0,size);r=rng.uniform(.5,5)
        col=rng.choice([(232,127,32,149),(222,109,31,116),(239,158,47,148),(191,69,25,88)])
        d.ellipse((x-r,y-r*.76,x+r,y+r*.76),fill=col)
    # Flat flecks of Sichuan pepper, chilli seed and scallion in the broth.
    for k in range(260):
        x,y=rng.uniform(12,size-12),rng.uniform(12,size-12);a=rng.random()*math.tau;r=rng.uniform(1,4)
        col=rng.choice([(81,33,20,220),(231,190,109,220),(112,114,53,209),(168,42,24,204)])
        p=[(x+math.cos(a+i*math.tau/4)*r*(1 if i%2 else 1.7),y+math.sin(a+i*math.tau/4)*r*(1 if i%2 else 1.7)) for i in range(4)]
        d.polygon(p,fill=col)
    save(im,'hotpot-broth',90)


def facade():
    rng.seed(91612)
    w,h=320,320
    im=base((w,h),(105,105),'#b7b8a9','#cecdc0')
    d=ImageDraw.Draw(im,'RGBA')
    for row in range(4):
        for col in range(4):
            x,y=col*80,row*80
            d.rectangle((x+8,y+14,x+70,y+67),fill=(86,94,89))
            d.rectangle((x+11,y+17,x+68,y+65),fill=(80,100,102))
            for pane in range(2):
                px=x+14+pane*26
                tone=rng.randint(-12,10)
                for line in range(42):
                    r,g,b=(94+tone,121+tone,131+tone)
                    d.line((px,y+20+line,px+22,y+20+line),fill=(r-line//4,g-line//3,b-line//3))
                if (row*4+col+pane)%5==0:
                    d.polygon([(px,y+20),(px+21,y+20),(px+14,y+35),(px,y+40)],fill=(174,170,143,199))
            d.line((x+11,y+31,x+67,y+31),fill=(155,163,154),width=2)
            d.rectangle((x+5,y+66,x+72,y+68),fill=(203,204,190))
            d.rectangle((x+5,y+69,x+72,y+71),fill=(126,130,121))
            if col%2==0: d.rectangle((x+74,y,x+78,y+79),fill=(211,211,195))
        d.rectangle((0,y+76,w,y+78),fill=(163,167,154))
    save(im,'school-facade',87)


if __name__=='__main__':
    for bake in [terrazzo,veneer,turf,running_track,upholstery,porcelain,quilt,soup,facade]:
        bake()

