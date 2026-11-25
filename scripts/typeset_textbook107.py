"""Typeset the desk textbook's public-domain selections. Requires Pillow and a CJK Song font."""
import argparse
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ASSETS = Path(__file__).resolve().parents[1] / 'dist/assets/materials'
ART = Path(__file__).resolve().parents[1] / 'art-source/textbook107'
ANALECTS = [
    ('学而', '子曰：“君子食无求饱，居无求安，敏于事而慎于言，就有道而正焉，可谓好学也已。”'),
    ('八佾', '子曰：“人而不仁，如礼何？人而不仁，如乐何？”'),
    ('里仁', '子曰：“朝闻道，夕死可矣。”'),
    ('里仁', '子曰：“君子喻于义，小人喻于利。”'),
    ('里仁', '子曰：“见贤思齐焉，见不贤而内自省也。”'),
    ('雍也', '子曰：“质胜文则野，文胜质则史。文质彬彬，然后君子。”'),
    ('泰伯', '曾子曰：“士不可以不弘毅，任重而道远。仁以为己任，不亦重乎？死而后已，不亦远乎？”'),
    ('子罕', '子曰：“譬如为山，未成一篑，止，吾止也。譬如平地，虽覆一篑，进，吾往也。”'),
    ('子罕', '子曰：“知者不惑，仁者不忧，勇者不惧。”'),
    ('颜渊', '颜渊问仁。子曰：“克己复礼为仁。一日克己复礼，天下归仁焉。为仁由己，而由人乎哉？”颜渊曰：“请问其目。”子曰：“非礼勿视，非礼勿听，非礼勿言，非礼勿动。”颜渊曰：“回虽不敏，请事斯语矣。”'),
    ('卫灵公', '子贡问曰：“有一言而可以终身行之者乎？”子曰：“其恕乎！己所不欲，勿施于人。”'),
    ('阳货', '子曰：“小子何莫学夫《诗》？《诗》可以兴，可以观，可以群，可以怨。迩之事父，远之事君。多识于鸟兽草木之名。”'),
]
LAOZI = [
    ('第十一章', '三十辐共一毂，当其无，有车之用。埏埴以为器，当其无，有器之用。凿户牖以为室，当其无，有室之用。故有之以为利，无之以为用。'),
    ('第二十四章', '企者不立，跨者不行，自见者不明，自是者不彰，自伐者无功，自矜者不长。其在道也，曰余食赘行。物或恶之，故有道者不处。'),
    ('第三十三章', '知人者智，自知者明。胜人者有力，自胜者强。知足者富，强行者有志。不失其所者久，死而不亡者寿。'),
    ('第六十四章', '其安易持，其未兆易谋，其脆易泮，其微易散。为之于未有，治之于未乱。合抱之木，生于毫末；九层之台，起于累土；千里之行，始于足下。为者败之，执者失之。是以圣人无为，故无败；无执，故无失。民之从事，常于几成而败之。慎终如始，则无败事。是以圣人欲不欲，不贵难得之货；学不学，复众人之所过，以辅万物之自然而不敢为。'),
]


def take_line(text, limit):
    cut = min(len(text), limit)
    if cut < len(text):
        while cut > 2 and (text[cut] in '，。；：！？、”）〉》' or text[cut - 1] in '“（〈《'):
            cut -= 1
    return text[:cut], text[cut:]


def render(font_path, left):
    page = Image.new('RGB', (1200, 1600), '#fbf7ed')
    draw = ImageDraw.Draw(page)
    def font(size):
        return ImageFont.truetype(font_path, size)

    ink, muted = '#25231f', '#6c6358'
    folio = 5 if left else 6
    title, rows = ('《论语》十二章', ANALECTS) if left else ('《老子》四章', LAOZI)
    draw.text((600, 74), str(folio), font=font(32), fill=ink, anchor='mm')
    draw.text((600, 172), title, font=font(68), fill=ink, anchor='mm')

    if left:
        portrait = Image.open(ART / 'confucius.webp')
        portrait.thumbnail((275, 440), Image.Resampling.LANCZOS)
        page.paste(portrait, (86, 280))
        image_bottom = 280 + portrait.height
        draw.text((86 + portrait.width // 2, image_bottom + 12), '孔子行教像', font=font(22), fill=muted, anchor='mt')
    else:
        landscape = Image.open(ART / 'meeting.webp')
        landscape.thumbnail((640, 224), Image.Resampling.LANCZOS)

    y = 265
    size, leading = (33, 44) if left else (38, 56)
    face = font(size)
    for i, (source, body) in enumerate(rows):
        if not left and i == 3:
            page.paste(landscape, ((1200 - landscape.width) // 2, y))
            y += landscape.height + 21
        line = '　　' + body + (f'（《{source}》）' if left else f'（{source}）')
        while line:
            x = (86 + portrait.width + 30) if left and y < image_bottom + 54 else 88
            fragment, line = take_line(line, (1112 - x) // size)
            draw.text((x, y), fragment, font=face, fill=ink, anchor='lt')
            y += leading
        y += 13 if left else 30
    assert y < 1540, (title, y)
    page.save(ASSETS / ('lunyu-12-107.webp' if left else 'laozi-4-107.webp'), 'WEBP', quality=94, method=5)


def render_cover(font_path):
    # Left half is the back cover. One atlas preserves continuity at the spine.
    cover = Image.new('RGB', (1536, 960), '#e2cfab')
    draw = ImageDraw.Draw(cover)
    draw.rectangle((0, 0, 768, 960), fill='#a53c32')
    draw.rectangle((0, 410, 760, 606), fill='#ce8b78')
    draw.rectangle((768, 0, 1536, 184), fill='#a33c32')
    for y in range(-160, 180, 12):
        points = [(x, y + round(100 * math.sin((x - 768) / 650))) for x in range(768, 1536, 6)]
        draw.line([(x, py) for x, py in points if 0 <= py < 184], fill='#b95142', width=2)
    lower = ImageOps.fit(Image.open(ART / 'fan-kuan.webp').convert('L'), (768, 450))
    wash = ImageOps.colorize(ImageOps.autocontrast(lower, cutoff=1), '#514b38', '#e2cfab')
    edge = Image.new('L', wash.size)
    edge_draw = ImageDraw.Draw(edge)
    for y in range(wash.height):
        edge_draw.line((0, y, 768, y), fill=min(255, y * 3))
    cover.paste(wash, (768, 510), edge)
    draw.rectangle((735, 0, 784, 166), fill='#50735e')
    draw.rectangle((735, 765, 784, 960), fill='#50735e')
    draw.rectangle((1130, 226, 1484, 495), fill='#f1e5c9')
    draw.text((1307, 336), '语文', font=ImageFont.truetype(font_path, 110), fill='#302a24', anchor='mm', stroke_width=1)
    draw.text((1307, 435), '七年级上册', font=ImageFont.truetype(font_path, 40), fill='#40382e', anchor='mm')
    cover.save(ASSETS / 'grade7-cover-107.webp', 'WEBP', quality=92, method=5)


if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('--font',default='/System/Library/Fonts/Supplemental/Songti.ttc')
    args=cli.parse_args()
    for left in (True,False):
        render(args.font,left)
    render_cover(args.font)
