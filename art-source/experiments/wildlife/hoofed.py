"""From-sprite large herbivores with editable necks, legs, tails and species features."""
import math

from wildlife_build import CatSurface, V, aimed, euler, rows, solve_knee, stride, transform

# Body half-width, half-length and depth, leg height, neck rise, head length,
# horn/coat structure. Palette is deepest shade, dark, coat, light, blaze,
# muzzle, hoof and feature. Individual profiles keep their characteristic form.
PROFILES = {
    "classic-cow": ("Classic Cow",(.55,1.04,.41),.53,.08,.42,"cow","4e3a4a 90625d dcb98a f3e5c2 f3e5c2 d99a9a 754c60 e8b5ac"),
    "cow": ("Pasture Cow",(.52,1.04,.43),.71,.14,.46,"cow","2d3035 56515a e5dfc9 f6ecd9 373b44 b88787 41404a d5bc8f"),
    "sheep": ("Sheep",(.51,.77,.43),.48,.14,.37,"wool","483e37 7d6b5e d4c6a4 ebe1c0 eddfc0 7b5f55 4c433e bdab86"),
    "horse": ("Horse",(.40,1.14,.40),1.03,.40,.55,"mane","3e3028 694a38 a4754c c3935c eed4a4 8f6b4e 4b3a36 513e34"),
    "donkey": ("Grey Donkey",(.40,.96,.38),.83,.36,.49,"long-ears","45443f 6c6b63 979389 b9b5a5 e2d9c1 c7bda9 514e49 55534e"),
    "mule": ("Brown Mule",(.39,1.02,.39),.90,.34,.50,"long-ears","44372f 715543 a37e57 c2986c dccaac ab8c6b 4e4136 5f483b"),
    "llama": ("Brown Llama",(.37,.87,.42),.90,.68,.37,"fleece","533c31 7d5840 ad825b c99b70 e4c7a1 95795e 59453b ad835c"),
    "alpaca": ("Cream Alpaca",(.41,.79,.47),.69,.62,.32,"fleece","5a5144 867966 c6b793 e4d5b0 f2e5c7 b29a7b 5d5142 d4c19d"),
    "goat": ("Goat",(.37,.83,.34),.72,.31,.34,"goat","4b4137 796958 af9b7c d6c0a0 e6d3b7 ad9075 544841 c4b6a0"),
    "piglet": ("Pig",(.43,.68,.35),.37,.04,.39,"pig","604a46 9e716c ca9890 e2b2a1 f0cec0 d7a09c 6b504d d69f9a"),
    "gemsbok-oryx": ("Gemsbok",(.39,.95,.37),.91,.29,.42,"gemsbok","37332c 776855 a79370 c7b18b e9d9b7 c0b191 37352f 494239"),
    "gazelle": ("Gazelle",(.30,.79,.28),.96,.30,.34,"gazelle","654632 94633c c28d54 d6ac73 e9d5ab b28b64 674c3a 594437"),
    "impala": ("Impala",(.30,.84,.31),1.00,.32,.35,"lyre","694532 976041 c4834e e1ad6c f0d6a5 bd915f 64463a 654b37"),
    "springbok": ("Springbok",(.28,.78,.28),.91,.28,.34,"springbok","614230 895c40 b78655 dbb181 ecd8b3 b28b67 614738 725644"),
    "saiga-antelope": ("Saiga Antelope",(.36,.83,.33),.81,.17,.36,"saiga","5e4d3d 887052 b59a74 d0b797 e2cbac c6ac8a 6b5542 a5967c"),
    "gerenuk": ("Gerenuk",(.28,.83,.29),1.02,.63,.30,"gerenuk","593e2c 88573b b98451 d0a06b e3caa0 ab8463 614a38 655445"),
    "american-bison": ("American Bison",(.56,1.10,.49),.67,.16,.48,"bison","362f29 554336 7c5e45 a17855 c4a179 604737 49392e b6a287"),
    "water-buffalo": ("Water Buffalo",(.53,1.08,.45),.72,.08,.49,"buffalo","383b3b 555c5b 737b78 939791 b1aba0 777670 424948 b0a99b"),
    "musk-ox": ("Musk Ox",(.56,.95,.52),.54,.06,.43,"musk","332e28 514339 736253 9a846e bfa68a 685849 43372f c2b296"),
    "wildebeest": ("Wildebeest",(.43,.98,.41),.80,.15,.47,"wildebeest","3b372e 666053 928574 b3a38b c6b89e 7a6a59 474137 9c8e76"),
    "zebra": ("Zebra",(.41,1.00,.40),.90,.38,.49,"zebra","22252b 45454a d8d5c8 f1eadd f8f1e0 656066 36343b 333137"),
    "okapi": ("Okapi",(.39,.93,.39),.92,.54,.43,"okapi","382a29 664236 94705a b99173 e0d0b4 af8f76 453833 8d735f"),
    "camel": ("Dromedary Camel",(.43,1.08,.40),1.00,.67,.42,"hump","574639 8a6c4e b7996a d2b789 e5d0a9 ac906b 6b5544 b59c78"),
    "moose": ("Moose",(.49,1.04,.43),1.00,.34,.47,"palm","3e302b 6b5142 947157 b28b6a d0ad89 866b56 4c3d34 b59a7c"),
    "elk": ("Elk",(.42,1.00,.38),.99,.42,.41,"antlers","493a36 765a47 a58360 c4a077 e1c6a4 9d795d 543f38 a89278"),
    "rhinoceros": ("White Rhinoceros",(.58,1.14,.48),.55,.01,.53,"rhino","414645 646966 8b8e83 a9a796 c7c3ab 7a7d72 4e5651 bbb29a"),
    "warthog": ("Warthog",(.47,.88,.39),.48,.08,.46,"warthog","4b3d35 725a49 9a7c5f b99b7a d9c5a2 a98b75 5a463b e0c7a1"),
    "hippopotamus": ("Hippopotamus",(.66,1.11,.54),.36,.07,.54,"hippo","494753 6d6574 948591 b2a1a9 c6afb0 a592a0 625767 b29ca5"),
    "malayan-tapir": ("Malayan Tapir",(.52,.96,.47),.57,.08,.46,"tapir","20282d 3e484c 5b6668 758385 e3dec9 536063 2e373a b1ab9a"),
    "deer": ("White-tailed Deer",(.36,.94,.35),.92,.34,.39,"antlers","593e32 865b43 b1825c cba17a eed9b3 ad896d 665049 c1af93"),
    "elephant": ("Elephant",(.67,1.06,.60),.70,.11,.51,"elephant","41464b 636c73 8b9397 aeb4af c3c8b8 848b8d 525960 ddd9bd"),
    "giraffe": ("Giraffe",(.41,.97,.38),1.12,1.18,.38,"giraffe","59422f 916c4c c29a62 e0b981 e7cb96 b69876 6a543c 967046"),
}
MAMMALS = {
    "fox": ("Red Fox",(.32,.91,.29),.64,.22,.43,"fox","3d3029 81533a b76b3c d58a50 e7d5ad 9b7357 362f2a 6d4e39"),
    "wolf": ("Grey Wolf",(.36,1.02,.32),.82,.24,.45,"wolf","373a38 66685f 8c8d7d acaa96 d3cbb0 756c60 4a4840 777668"),
    "coyote": ("Coyote",(.29,.99,.30),.80,.21,.46,"wolf","463d33 7c6c56 9f8a6d bcaa87 dbca9e 806b57 504639 8d775d"),
    "dire-wolf": ("Dire Wolf",(.48,1.09,.40),.82,.26,.45,"wolf","303137 58575d 7b7881 a19ca1 bdb9ad 585361 3b3946 695d71"),
    "spotted-hyena": ("Spotted Hyena",(.36,.88,.33),.86,.28,.49,"hyena","302b25 604735 b09261 cbb07a e8cd98 503a2d 3b2d24 493831"),
    "brown-bear": ("Brown Bear",(.55,1.02,.49),.47,.15,.42,"bear","3d302a 644a38 916d51 b08b64 dbc5a1 805d45 49382c 6d4d3b"),
    "polar-bear": ("Polar Bear",(.51,1.05,.46),.55,.15,.46,"bear","52574f 928f7d c9c3a8 e4dfc2 f2e8cc 9a8e72 5e5b53 c8c0aa"),
    "panda": ("Panda",(.54,.91,.49),.42,.13,.35,"panda","2a2e32 444951 d4d0bb ebe5cf f3ead1 868073 36383f 363b42"),
    "guinea-pig": ("Guinea Pig",(.43,.69,.35),.21,.06,.34,"guinea","514233 8c673f b79366 d2b383 ebd4a7 b68a68 554537 754f3c"),
    "hamster": ("Hamster",(.37,.58,.36),.22,.12,.30,"hamster","544237 936a49 bd996e ddb58b f0d5ad b99479 645347 997459"),
    "aardvark": ("Aardvark",(.32,.82,.32),.44,.13,.56,"aardvark","51443b 856e5e a88d77 c5a792 e0c2ab b39481 57483f 8d6960"),
    "armadillo": ("Armadillo",(.41,.76,.37),.24,.04,.37,"armor","473b33 776052 9c8571 bda68d d5bca0 8c735f 534439 72594a"),
    "aye-aye": ("Aye-aye",(.36,.73,.36),.40,.17,.34,"aye","342d2a 5b4c47 7d6d62 a18c79 cfc1a6 846e61 4d4036 6b5647"),
    "beaver": ("Beaver",(.43,.75,.36),.29,.10,.39,"paddle","46372e 755341 9e7654 b9966f e0c6a0 a17c5e 514134 654b3b"),
    "binturong": ("Binturong",(.46,.83,.39),.41,.16,.35,"grizzle","373633 55534e 7b776d a39c87 d6cbb2 786a5c 474640 6e6560"),
    "capybara": ("Capybara",(.44,.80,.38),.30,.15,.39,"capybara","473f31 82694c a78b65 c1a77e d9c49c b19a7b 5d5140 846a51"),
    "chinchilla": ("Chinchilla",(.39,.63,.35),.28,.14,.31,"chinchilla","48444a 78767f a29da4 c1babe e1d4c9 b5a0a2 55525a 7a737e"),
    "fossa": ("Fossa",(.33,.86,.30),.47,.15,.42,"longtail","423930 715a48 987f67 b69b7c d0bd9a 876c5b 4f4338 7a614e"),
    "giant-anteater": ("Giant Anteater",(.38,.91,.32),.46,.10,.66,"anteater","363132 5c4b43 8a7966 b19d84 ddceb2 807267 4a443f 544d45"),
    "hedgehog": ("Hedgehog",(.38,.62,.38),.20,.03,.33,"short-quill","493930 755b44 9d7e61 be9c78 e7cba3 a28672 534438 7e6048"),
    "honey-badger": ("Honey Badger",(.39,.82,.34),.31,.09,.38,"badge","2e2929 555251 898780 b0aa98 dfdbc5 685c53 403a39 7e7972"),
    "kinkajou": ("Kinkajou",(.35,.72,.32),.39,.13,.37,"longtail","493b30 87674c b1916a c8a87d e4c69b a28a6e 534134 856047"),
    "meerkat": ("Meerkat",(.28,.67,.29),.39,.12,.38,"meerkat","544638 8b7256 b49773 d0b38a e5cda6 ad9579 544438 806b59"),
    "mongoose": ("Mongoose",(.28,.77,.28),.44,.14,.38,"longtail","4d4138 7a6651 a28c72 bba188 d9c4a5 9a7964 59493b 7d6954"),
    "mouse": ("Mouse",(.30,.59,.29),.24,.11,.32,"mouse","4b4140 78635a a28675 c1a491 e8ccb2 b09084 5d4f49 9d8074"),
    "pangolin": ("Pangolin",(.44,.77,.38),.29,.05,.39,"scales","4b4034 7e6a52 a49074 c1aa8a e0ccb0 9c846e 584b3b 8e785d"),
    "porcupine": ("Porcupine",(.40,.73,.36),.34,.03,.43,"long-quill","272323 392a26 514034 695143 f2ddae 392a28 382925 ebd6ac"),
    "raccoon": ("Raccoon",(.39,.77,.34),.35,.14,.41,"raccoon","2f3034 5b5a5b 848184 a5a199 e1d5bb 88837d 414047 666065"),
    "rat": ("Rat",(.32,.66,.29),.25,.10,.39,"mouse","4a4240 756663 9d8a80 b9a297 e1cbc1 b29289 5e4c46 9a817b"),
    "red-panda": ("Red Panda",(.43,.80,.38),.34,.16,.37,"red-panda","392c2a 784337 ad6544 cf8658 ecd6b2 ab7869 46332d 975c44"),
    "red-squirrel": ("Red Squirrel",(.32,.63,.32),.29,.16,.32,"squirrel","4e352a 916244 b98152 d4a173 ebd1a5 9c745a 604335 a16949"),
    "river-otter": ("River Otter",(.37,.86,.31),.28,.10,.38,"otter","3d3029 674b3a 927258 b19476 d7be9e 956f5e 4c3d33 735843"),
    "skunk": ("Skunk",(.36,.75,.34),.29,.09,.37,"skunk","26272e 41424b 666574 88858e e8e2ce 78737b 353642 bbb7bb"),
    "sloth": ("Three-toed Sloth",(.37,.67,.35),.37,.12,.33,"sloth","504238 806b58 a78e71 c5ac89 e4ceb0 9f8977 624e42 a18d76"),
    "white-nosed-coati": ("White-nosed Coati",(.33,.77,.31),.42,.15,.47,"coati","44382e 755b46 a48462 c29f73 e4cfac a38668 5a483a 8c6d55"),
    "platypus": ("Platypus",(.40,.71,.25),.23,.07,.42,"platypus","403730 6c594b 927b66 b39b81 d7bda0 68737a 4b4442 776454"),
    "koala": ("Koala",(.42,.64,.39),.32,.22,.31,"koala","42444b 70737a 92979e b5b8b7 e1dbcf 818489 51555c b6a8a3"),
    "quokka": ("Quokka",(.37,.64,.34),.31,.19,.34,"quokka","4e3d33 81674e a98b69 c7a982 e5cba4 af9278 5f4b3e 967658"),
    "echidna": ("Short-beaked Echidna",(.43,.74,.39),.21,.03,.46,"short-quill","493c31 77614a 9d876e beaa8e e1cbb0 a29180 524637 8e755c"),
    "tasmanian-devil": ("Tasmanian Devil",(.41,.73,.35),.34,.14,.40,"devil","2d2c31 4b4649 6a6466 878081 e0d4bb 795f61 3d3739 62494e"),
    "opossum": ("Virginia Opossum",(.36,.72,.34),.32,.14,.43,"opossum","403b3d 706568 9a8987 bba8a0 ead5bd af958f 574747 a7837c"),
    "wombat": ("Wombat",(.45,.68,.39),.26,.10,.35,"wombat","4b3d34 7c6755 a68c73 c0a68a d9c2a6 997d6b 57473d a0826c"),
}
PROFILES.update(MAMMALS)
LIGHT=V((-.44,.29,.85)).normalized()
SIDES=(("l",1),("r",-1))
NAME=PALETTE=DURATIONS=STYLE=None
BODY=HEAD=TAIL=None
WIDTH=LENGTH=DEPTH=LEG=NECK=SNOUT=None
LEGS=EARS=TRUNK=None
PAWED=False
FARM_ROLLOUT=False
GRAZER_MOTION=None
JAW=None


def configure(key):
    global NAME,PALETTE,DURATIONS,STYLE,WIDTH,LENGTH,DEPTH,LEG,NECK,SNOUT
    global BODY,HEAD,TAIL,LEGS,EARS,TRUNK
    global PAWED
    PAWED=key in MAMMALS
    NAME,(WIDTH,LENGTH,DEPTH),LEG,NECK,SNOUT,STYLE,colors=PROFILES[key]
    PALETTE=dict(zip(("ink","dark","coat","light","blaze","muzzle","hoof","feature"),colors.split()))
    DURATIONS={
        "idle":48,"walk":27,"action":22,"browse":27,"lower":24,"raise":24,"lie":27,
        "stand":27,"ruminate":46,"roll":37,"rear":26,"hop":23,"stamp":21,"reach":26,
        "curl":26,"shake":25,"eat":27,"sniff":21,"root":25,"pickup":18,"bleat":24,
        "stalk":30,"pounce":19,"listen":23,"swim":27,"feed":26,"display":26,
        "alarm":23,"scan":42,"dig":28,"curled":45,"curl-in":24,"uncurl":24,
        "rattle":26,"quills":21,"relax":24,"settle":27,"build":26,"sleep":40,
    }
    BODY=V((0,0,LEG+.34*DEPTH))
    HEAD=BODY+V((0,LENGTH*.79,NECK+DEPTH*.19))
    TAIL=BODY+V((0,-LENGTH*.93,DEPTH*.53))
    EARS={side:HEAD+V((sign*WIDTH*.39,.004,.125)) for side,sign in SIDES}
    TRUNK=[HEAD+V(p) for p in ((0,.43,.015),(0,.53,-.28),(0,.52,-.57),(0,.64,-.81))]
    LEGS={}
    for side,sign in SIDES:
        for front in (True,False):
            x=sign*WIDTH*(.56 if front else .57)
            y=LENGTH*(.66 if front else -.66)
            z=BODY.z-DEPTH*.24
            if STYLE=="hyena":
                z+=.23 if front else -.14
            knee=V((x,y+(-.10 if front else .19),max(.19,z*.55)))
            ankle=V((x,y+(.06 if front else -.15),.125))
            LEGS[("fore" if front else "hind")+"."+side]=(V((x,y,z)),knee,ankle)


def configure_rollout():
    global FARM_ROLLOUT, HEAD, EARS, JAW, DURATIONS, PALETTE
    farm = {
        "cow": ("303a37 46534d dbdecb f1ead2 26302e ce9c92 26302e a87773",
                ("lower","graze","raise","lie","ruminate","stand")),
        "wool": ("222d2c 48534c d9ddbf efe7cc a5ae96 394239 222d2c a5ae96",
                 ("bleat",)),
        "mane": ("242f2d 815333 a86836 c78949 e6dec4 5e5139 374138 747667",
                 ("lower","graze","drink","raise","ride","ride-sprint")),
        "long-ears": ("272f30 525653 a7aaa1 c8c9bd d3cdb9 525653 3b3f40 525653",
                      ("lie","roll","stand","ride","ride-sprint")),
        "goat": ("242b27 493e32 a67a49 bd9862 d8c59d 805a39 3e3c32 6f7562",
                 ("rear","browse","lower","hop")),
        "pig": ("25322f 8b5557 dab39d ead0b6 ead0b6 c77f78 514943 bb8e83",
                ("sniff","root","pickup","eat")),
    }
    colors, actions = farm[STYLE]
    classic = NAME == "Classic Cow"
    if classic:
        colors, actions = "4e3a4a 90625d dcb98a f3e5c2 f3e5c2 d99a9a 754c60 e8b5ac", ()
    FARM_ROLLOUT = True
    if STYLE=="mane":
        offset = V((0,.235,.204))
        HEAD += offset
        EARS = {side:root+offset for side,root in EARS.items()}
    JAW = HEAD+V((0,SNOUT*.25,-.114))
    PALETTE = dict(zip(("ink","dark","coat","light","blaze","muzzle","hoof","feature"),colors.split()))
    DURATIONS = {"idle":48,"walk":31,"action":23,"flee":18}
    lengths = {"ruminate":48,"roll":48,"ride":27,"ride-sprint":19}
    DURATIONS.update((name,lengths.get(name,25)) for name in actions)


def configure_grazers():
    global GRAZER_MOTION, DURATIONS, PALETTE, STYLE, NAME
    # Active sprite palette and side-on action frames supply coat, dip depth,
    # how far the muzzle reaches, and the flex of the escape stride.
    profiles = {
        "gemsbok": ("202c2b 4a4132 9b947d c8c0a5 e2d9bd 4e4535 282a28 4a4132", .39,.23,.28),
        "gazelle": ("202c2b 4a4132 b18a55 d8b77c e8d8ad 4e4535 282a28 4a4132", .42,.10,.33),
        "springbok": ("202c2b 4a4132 bc955c dfc38b f0dfb6 4e4535 282a28 4a4132", .34,.16,.39),
        "gerenuk": ("202c2b 4a4132 a3774b cfa16b e8d6aa 4e4535 282a28 4a4132", .65,.24,.29),
        "lyre": ("202c2b 4a4132 ae7141 d79854 e6ce9b 4e4535 282a28 4a4132", .51,.18,.36),
        "saiga": ("202c2b 4a4132 baa879 d8c798 e8d9af e8d9af 282a28 4a4132", .30,.22,.24),
        "bison": ("182421 44362b 72543b a08151 ccb98a 34312b 262b2a ccb98a", .31,.13,.19),
        "buffalo": ("182421 42443d 69675f 928e7d c8bd9c 34312b 262b2a c8bd9c", .32,.18,.17),
        "wildebeest": ("182421 4a4437 897d68 b2a38a c9bca0 34312b 262b2a c9bca0", .39,.21,.24),
        "musk": ("182421 3d352a 5c4630 8c7651 d6c7a1 34312b 262b2a d6c7a1", .23,.12,.14),
        "antlers": ("403b30 65472f ae8050 c7a671 e3ce9e 65472f 403b30 e3ce9e", .51,.22,.30),
        "palm": ("30372d 41382b 695038 99724c 99724c 41382b 403b30 c8ac74", .47,.27,.26),
        "zebra": ("182421 393a33 e6e2d1 f5efdc b6b3a4 3c3a32 272e2b 393a33", .44,.19,.31),
        "rhino": ("403b30 5c6059 92938b b7b7a7 c8bda1 5c6059 403b30 c8bda1", .21,.13,.16),
        "doe": ("28241f 574031 ad8050 cfa16b efe2c2 806044 423b32 dfc69b", .71,.32,.30),
        "llama": ("2f3531 624435 b28c60 d2b185 e2ccaa 74533d 323731 74533d", .61,.26,.23),
        "alpaca": ("353c36 928776 d8cdb3 f2e6cc e7d8ba a3937b 393d35 e7d8ba", .49,.18,.21),
        "okapi": ("1e2929 43382e 77523a 9b7954 e4d6b8 3e3329 2e3230 e4d6b8", .51,.21,.25),
        "tapir": ("202b2e 242c31 303b3d 535c5d ded8be 303b3d 202b2e 535c5d", .26,.17,.15),
        "warthog": ("1c2926 5b4a36 8a6b4e b18e64 e2d1a1 5b4a36 30372d e2d1a1", .33,.17,.23),
        "elephant": ("293438 586363 828b85 a1aaa0 bbc2b2 6d7774 41494b d9d1b1", .28,.14,.12),
        "giraffe": ("302d26 976033 c49a5c dfb97b ead2a0 86603b 59422f f7e7c3", .44,.22,.26),
        "long-ears": ("252b29 503b2d 916b49 b89060 cdb68c 916b49 3e3028 2b2c29", .32,.14,.28),
        "hump": ("26302b 5b4b34 b38e54 d9b77d d1b47f 775f3e 3b3528 5b4b34", .53,.22,.24),
        "guinea": ("242c31 815239 d3a05b e8c07d eee4c9 815239 815239 eee4c9", .09,.055,.10),
        "hamster": ("242c31 a56c40 c28b48 e3b667 f0dbb2 a56c40 a56c40 f0dbb2", .12,.060,.13),
        "chinchilla": ("242c31 727a7f 92999b bec5c3 deddd0 727a7f 727a7f bec5c3", .11,.047,.16),
        "mouse": ("242c31 9a8f7d c5b9a0 e4d9bf e4d9bf be8b88 be8b88 be8b88", .085,.045,.15),
        "rat": ("242c31 817a72 aaa297 c7bca9 c7bca9 ad8580 ad8580 ad8580", .10,.073,.19),
        "opossum": ("1e2826 5f6258 888a7d ded6bb ded6bb c69487 5f6258 c69487", .13,.067,.15),
        "quokka": ("242c31 6c593f 9a8056 c1a574 ded8be 6c593f 6c593f 6c593f", .14,.057,.17),
        "wombat": ("242c31 655b4a 8e7b61 b39d79 b39d79 655b4a 655b4a 655b4a", .13,.086,.12),
    }
    if NAME == "White-tailed Deer":
        STYLE, NAME = "doe", "White-tailed Doe"
    profile = {"Brown Llama":"llama", "Cream Alpaca":"alpaca", "Rat":"rat"}.get(NAME, STYLE)
    colors, depth, reach, bound = profiles[profile]
    GRAZER_MOTION = (depth, reach, bound)
    PALETTE = dict(zip(PALETTE, colors.split()))
    DURATIONS = {"idle":48, "walk":33, "action":25, "flee":21}
    actions = {
        "doe": {"lower":24,"browse":36,"raise":24,"stamp":20},
        "elephant": {"reach":40,"curl":40,"eat":44,"shake":40},
        "giraffe": {"reach":35,"browse":46,"lower":35},
        "long-ears": {"ride":29,"ride-sprint":21},
        "hump": {"ride":34,"ride-sprint":24},
    }
    DURATIONS.update(actions.get(STYLE,{}))


def neck_base():
    return BODY+V((0,LENGTH*.61,DEPTH*.28))


def giraffe_neck():
    base=neck_base()
    return base,base.lerp(HEAD,.51)+V((0,-.115,.045)),HEAD


def joints():
    entries=[
        ("body",BODY,BODY+V((0,.64,0)),None),
        ("head",HEAD,HEAD+V((0,.32,0)),"body"),
        ("tail",TAIL,TAIL+V((0,-.36,-.23)),"body"),
    ]
    for side,sign in SIDES:
        p=EARS[side]
        entries.append((f"ear.{side}",p,p+V((sign*.25,-.035,.210)),"head"))
    if FARM_ROLLOUT:
        entries.append(("jaw",JAW,JAW+V((0,SNOUT*.65,-.033)),"head"))
    for name,(a,b,c) in LEGS.items():
        upper,lower,paw=f"{name}.upper",f"{name}.lower",f"{name}.hoof"
        entries.extend(((upper,a,b,"body"),(lower,b,c,upper),(paw,c,c+V((0,.21,0)),lower)))
    if STYLE=="elephant":
        for i in range(len(TRUNK)-1):
            entries.append((f"trunk{i}",TRUNK[i],TRUNK[i+1],f"trunk{i-1}" if i else "head"))
    if GRAZER_MOTION and STYLE=="giraffe":
        base,middle,skull=giraffe_neck()
        entries.extend([("neck.base",base,middle,"body"),("neck.upper",middle,skull,"neck.base")])
    if STYLE=="long-quill":
        for side,sign in SIDES:
            pivot=BODY+V((sign*.17,-.06,.18))
            entries.append((f"quills.{side}",pivot,pivot+V((0,-.3,.2)),"body"))
    return entries


def band(normal, base="coat"):
    value=normal.dot(LIGHT)
    if base == "blaze":
        return "blaze" if value>-.24 else "light"
    if base in ("ink","feature","hoof","muzzle"):
        return base
    return "dark" if value<-.38 else "light" if value>.57 else base


def body_color(point,normal):
    p=point-BODY
    if FARM_ROLLOUT and NAME=="Classic Cow":
        pattern = ((p.y+.05)/.31)**2 + ((p.z+.13)/.25)**2
        rump = ((p.y+.60)/.26)**2 + ((p.z-.19)/.25)**2
        if abs(p.x)>.25 and min(pattern,rump)<1:
            return "dark" if normal.dot(LIGHT)<.23 else "coat"
        return "light" if normal.dot(LIGHT)>-.41 else "coat"
    if FARM_ROLLOUT and STYLE=="cow":
        side = abs(p.x)
        flank = ((p.y+.13)/.44)**2+((p.z-.053)/.243)**2
        rump = ((p.y+.79)/.28)**2+((p.z+.09)/.28)**2
        shoulder = ((p.y-.69)/.24)**2+((p.z+.19)/.22)**2
        if side>.24 and min(flank,rump,shoulder)<1:
            return "ink" if normal.dot(LIGHT)<-.23 else "blaze"
        if p.z>DEPTH*.77 and abs(p.y+.29)<.40:
            return "blaze"
        return band(normal)
    if FARM_ROLLOUT and STYLE=="goat" and p.z>DEPTH*.76 and abs(p.x)<WIDTH*.39:
        return "dark" if normal.dot(LIGHT)>.05 else "ink"
    if PAWED:
        if STYLE in ("wolf","fox","coati","otter","meerkat") and p.z<-.11:
            return band(normal,"blaze")
        if STYLE in ("skunk","badge") and p.z>DEPTH*.36 and (STYLE=="badge" or abs(p.x)<WIDTH*.36):
            return "blaze"
        if STYLE in ("panda","red-panda","devil") and p.y>LENGTH*.31 and p.z<.14:
            return "blaze" if STYLE=="devil" else "ink"
        if STYLE=="anteater" and abs(p.z+.22*p.y)<.125 and -.19<p.y<.52:
            return "ink" if abs(p.x)>.11 else "dark"
        if STYLE in ("armor","scales") and p.z>-.12:
            return "dark" if math.cos(p.y*29+abs(p.x)*6)>.34 else band(normal)
        if STYLE=="hyena":
            if p.z>.26 and abs(p.x)<.17:
                return "dark"
            u=(p.y*6.7+math.floor(p.z*10)*.32)%1-.5
            v=(p.z*9.8)%1-.5
            return "dark" if u*u+v*v<.104 else band(normal)
        if STYLE in ("grizzle","meerkat") and p.z>.03:
            u=(p.y*4.4)%1-.5
            v=(p.z*6+math.floor(p.y*5)*.27)%1-.5
            return "dark" if u*u+v*v<.094 else band(normal)
    if STYLE=="zebra":
        if GRAZER_MOTION:
            stripe = p.y*31 + (p.z*p.y)*9 + 2.0*math.sin(p.z*5)
            return "ink" if math.cos(stripe)>.09 else "light" if normal.dot(LIGHT)>.4 else "coat"
        if math.cos(p.y*27+abs(p.x)*5-p.z*5)>.43:
            return "ink"
    if STYLE=="cow" and ((p.y+.38)**2+(p.z+.03)**2*2<.16 or
       (p.y-.46)**2+(p.z-.22)**2*1.6<.16):
        return "ink" if normal.dot(LIGHT)<.35 else "blaze"
    if STYLE=="tapir":
        if GRAZER_MOTION:
            edge = p.y-.11*p.z
            if -.79*LENGTH<edge<.27*LENGTH:
                return "blaze"
            return "ink" if normal.dot(LIGHT)<-.34 else "coat"
        return "blaze" if -.72*LENGTH<p.y<.15*LENGTH else band(normal,"ink")
    if STYLE=="doe" and p.z<-.17:
        return "blaze" if normal.dot(LIGHT)>-.45 else "feature"
    if GRAZER_MOTION and STYLE=="okapi" and p.y<-.47 and p.z<.16:
        return "blaze" if math.cos(42*p.z+9*p.y)>.05 else "dark"
    if GRAZER_MOTION and STYLE=="warthog" and p.z>.15 and abs(p.x)<.17:
        return "dark"
    if STYLE in ("springbok","gazelle","gerenuk","gemsbok") and abs(p.x)>WIDTH*.59:
        if -.14<p.z<-.025:
            return "ink" if STYLE in ("springbok","gemsbok") else "dark"
        if p.z<-.14:
            return band(normal,"blaze")
    if STYLE=="giraffe":
        a=(p.y*4.5+math.floor(p.z*6)*.22)%1-.5
        b=(p.z*6+abs(p.x)*1.1)%1-.5
        return "dark" if abs(a)<.38 and abs(b)<.36 else band(normal,"blaze")
    if STYLE in ("bison","musk","wildebeest") and p.y>.23:
        return "dark" if normal.dot(LIGHT)>.05 else "ink"
    return band(normal)


def head_color(p,n):
    q=p-HEAD
    if GRAZER_MOTION and STYLE in ("guinea","hamster","chinchilla","opossum"):
        if q.y>SNOUT*.21 and q.z<(0.14 if STYLE in ("guinea","opossum") else 0):
            return "blaze"
    if STYLE=="doe" and (q.z<-.10 or q.y>.20 and q.z<.05):
        return "feature" if n.dot(LIGHT)<-.27 else "blaze"
    if FARM_ROLLOUT:
        if STYLE=="wool":
            return "muzzle" if n.dot(LIGHT)>.36 else "ink"
        if STYLE=="cow":
            if NAME=="Classic Cow":
                return "light" if n.dot(LIGHT)>-.40 else "coat"
            return band(n) if abs(q.x+.036)<.094 and q.y>.05 else "blaze"
        if STYLE=="long-ears" and q.y>SNOUT*.51:
            return "blaze"
        if STYLE=="goat" and q.y>.065 and (q.z<-.031 or abs(q.x)<.086):
            return "blaze"
    if PAWED:
        if STYLE in ("raccoon","panda","red-panda","meerkat","sloth") and q.y>.035 and abs(q.x)>.075 and -.05<q.z<.14:
            return "ink" if STYLE in ("raccoon","panda") else "dark"
        if STYLE in ("coati","raccoon","panda","red-panda","opossum","fox","wolf") and q.y>.07 and q.z<.041:
            return "blaze"
        if STYLE in ("anteater","shrew") and q.y>.21:
            return "dark"
    if STYLE=="giraffe" and p.z<HEAD.z-.19:
        if GRAZER_MOTION:
            height=(p.z*6.5)%1-.5
            side=(math.atan2(p.x,p.y-giraffe_neck()[0].y)*1.28+math.floor(p.z*6.5)*.36)%1-.5
            return "dark" if abs(height)+.28*abs(side)<.35 and abs(side)<.39 else band(n,"blaze")
        return "dark" if math.cos(p.z*23+abs(p.x)*10)>.06 else band(n,"blaze")
    if STYLE=="zebra":
        if GRAZER_MOTION:
            if q.y>SNOUT*.43 or math.cos(q.y*18+q.z*24)>.18:
                return "ink"
            return "light" if n.dot(LIGHT)>.4 else "coat"
        if math.cos(q.y*27+q.z*21)>.35:
            return "ink"
    if STYLE in ("gemsbok","wildebeest") and q.y>.17 and abs(q.x)>.10:
        return "dark"
    if STYLE in ("bison","musk","palm") and q.y>.17:
        return "dark"
    if STYLE in ("gazelle","springbok","gerenuk") and .08<abs(q.x)<.23 and q.y>.13:
        return "blaze"
    if STYLE=="cow" and abs(q.x)<.095 and q.y>.07:
        return band(n,"blaze")
    return band(n)


def surface():
    s=CatSurface()
    s.start("Species body and coat")
    rings=[]
    body_profile = (
        (-1.08,.13,.19),(-.94,.64,.72),(-.75,.91,.92),(-.5,1.0,.965),
        (-.18,1.0,1.0),(.18,.98,1.0),(.50,1.0,.973),(.76,.91,.87),(.95,.64,.73),(1.06,.21,.29),
    )
    patterned = GRAZER_MOTION and STYLE in ("zebra","giraffe")
    if patterned:
        # Sample the coat markings without aliasing across long body faces.
        subdivisions=6 if STYLE=="giraffe" else 10
        body_profile = tuple(
            tuple(v+(w-v)*i/subdivisions for v,w in zip(start,end))
            for start,end in zip(body_profile,body_profile[1:])
            for i in range(subdivisions)
        )+(body_profile[-1],)
    sides = 24 if patterned else 18
    for along,rx,h in body_profile:
        shoulder = along*.24 if STYLE=="hyena" else .15 if STYLE in ("bison","musk","wildebeest") and along>.24 else 0
        center=BODY+V((0,along*LENGTH,shoulder))
        chest = 1+.23*along if STYLE=="hyena" else 1
        ring=[center+V((WIDTH*rx*chest*math.cos(math.tau*i/sides),0,DEPTH*h*chest*math.sin(math.tau*i/sides)))
              for i in range(sides)]
        rings.append((ring,{"body":1} if along<.74 else {"body":.91,"head":.09}))
    s.rings(rings,body_color)
    if STYLE=="long-quill":
        s.start("Banded crown of quills")
        for side, sign in SIDES:
            bone = f"quills.{side}"
            for row in range(7):
                for i in range(5):
                    angle=.12+i*.39+(row%2)*.10
                    base=BODY+V((sign*WIDTH*.91*math.sin(angle),LENGTH*(.53-row*.21),DEPTH*.91*math.cos(angle)))
                    reach=.30+i*.066+row*.017
                    delta=V((sign*math.sin(angle)*reach,-reach*(.94+row*.045),math.cos(angle)*reach*.92))
                    rings=[(base+delta*t,r,r*.82,weights) for t,r,weights in (
                        (0,.051,{"body":1}),(.28,.061,{"body":.30,bone:.70}),
                        (.54,.045,{bone:1}),(.76,.031,{bone:1}),(1,.006,{bone:1}))]
                    def paint(point,normal):
                        position=(point-base).dot(delta)/delta.length_squared
                        return "feature" if .29 < position < .70 else "ink" if position<.58 else "light"
                    s.tube(rings,paint,sides=6)
    if STYLE=="short-quill":
        s.start("Distinct quill coat")
        reach=.119
        for row in range(6):
            for i in range(-4,5):
                angle=i*.28 + (row%2)*.12
                p=BODY+V((WIDTH*.86*math.sin(angle),LENGTH*(.42-row*.22),DEPTH*.85*math.cos(angle)))
                tip=p+V((math.sin(angle)*reach,-reach*(.72+row*.03),math.cos(angle)*reach))
                s.tube([(p,.045,.046,{"body":1}),(tip,.007,.010,{"body":1})],
                       lambda p,n:"feature" if n.dot(LIGHT)>.21 else "dark",sides=6)
    if STYLE in ("wool","fleece"):
        s.start("Rounded fleece clusters")
        for y in (-.57,0,.47):
            for sign in (-1,1):
                p=BODY+V((sign*WIDTH*.58,y*LENGTH,.14))
                s.ellipsoid(p,(WIDTH*.46,.41,DEPTH*.70),"body",body_color,sides=9,steps=6)
    if STYLE=="hump":
        s.start("Dromedary hump")
        s.ellipsoid(BODY+V((0,-LENGTH*.27,DEPTH*.64)),(WIDTH*.75,LENGTH*.56,DEPTH*1.09),
                    "body",body_color,sides=14,steps=9)
    if STYLE in ("mane","zebra","wildebeest","warthog","hyena"):
        s.start("Dorsal mane")
        for i in range(4):
            p=BODY+V((0,LENGTH*(.84-i*.15),DEPTH*(.79+i*.033)+(.24-i*.040 if STYLE=="hyena" else 0)))
            s.ellipsoid(p,(WIDTH*.29,.249,.19 if STYLE=="hyena" else .228 if i<2 else .157),"body",lambda p,n:"feature",sides=9,steps=6)
    if (FARM_ROLLOUT and STYLE in ("mane","long-ears")) or (GRAZER_MOTION and STYLE=="long-ears"):
        s.start("Dark neck mane")
        crest = []
        for t in (0,.22,.45,.68,.87,1):
            origin = (BODY+V((0,LENGTH*.40,DEPTH*.83))).lerp(HEAD+V((0,-.153,.191)),t)
            weights = {"body":1-t,"head":t}
            crest.append((origin,.061+.024*math.sin(t*math.pi),
                          .05+.079*math.sin(t*math.pi),weights))
        s.tube(crest,lambda p,n:"ink" if n.dot(LIGHT)<.42 else "hoof",sides=10)
    s.start("Neck and distinctive head")
    base=neck_base()
    neck_curve=base.lerp(HEAD,.48)+V((0,-.121*(NECK>.30),.061))
    head_r=WIDTH*(.75 if STYLE in ("hippo","elephant","pig","warthog") else .63)
    if GRAZER_MOTION and STYLE=="giraffe":
        base,mid,end=giraffe_neck()
        neck=[]
        for i in range(25):
            t=i/24
            p=base.lerp(mid,t*2) if t<=.50 else mid.lerp(end,2*t-1)
            lower=max(0,1-abs(t-.23)*3.3)
            upper=max(0,1-abs(t-.73)*3.3)
            radius=WIDTH*(.77-.36*t)
            weights={"body":max(0,.20-t*2),"neck.base":lower,"neck.upper":upper,"head":max(0,t-.78)}
            neck.append((p,radius,radius*.80,weights))
        s.tube(neck,head_color,sides=18)
    else:
        s.tube([(base,WIDTH*.72,DEPTH*.73,{"body":.71,"head":.29}),
                (neck_curve,head_r*.87,head_r*.91,{"body":.32,"head":.68}),
                (HEAD,head_r*.87,head_r*.88,{"head":1})],
               head_color,sides=14)
    s.ellipsoid(HEAD,(head_r,SNOUT*.61,head_r*.86),"head",head_color,
                sides=30 if patterned else 16,steps=24 if patterned else 10)
    muzzle=HEAD+V((0,SNOUT*.53,-head_r*.23))
    muzzle_w=head_r*(.97 if STYLE in ("hippo","pig","warthog","rhino","cow") else .72)
    if STYLE in ("hyena","long-quill"):
        s.tube([(HEAD+V((0,SNOUT*t,-head_r*drop)),head_r*width,head_r*depth,{"head":1})
                for t,drop,width,depth in ((.20,.1,.89,.68),(.65,.21,.64,.53),(.98,.34,.38,.34),(1.08,.36,.24,.23))],
               lambda p,n:"ink" if p.y>HEAD.y+SNOUT*.85 else "muzzle" if p.y>muzzle.y else head_color(p,n),sides=12)
    else:
        s.ellipsoid(muzzle,(muzzle_w*(.58 if STYLE in ("anteater","aardvark") else 1),SNOUT*.63,head_r*.53),"head",
                    lambda p,n:band(n,"muzzle" if p.y>muzzle.y+SNOUT*.17 else "coat"),sides=14,steps=8)
    if STYLE=="platypus":
        p=muzzle+V((0,SNOUT*.49,-.044))
        s.ellipsoid(p,(muzzle_w*1.17,.23,.076),"head",lambda p,n:"muzzle",sides=14,steps=7)
    if FARM_ROLLOUT:
        s.start("Hinged lower muzzle")
        s.ellipsoid(JAW+V((0,.22,-.029)),(muzzle_w*.71,SNOUT*.48,.087),"jaw",
                    lambda p,n:"ink" if STYLE=="wool" else
                    "muzzle" if STYLE in ("cow","pig") else "dark",sides=16,steps=9)
        if STYLE=="goat":
            s.start("Beard")
            s.tube([(JAW+V((0,.069,-.052)),.091,.068,{"jaw":1}),
                    (JAW+V((0,.017,-.276)),.024,.019,{"jaw":1})],
                   lambda p,n:"dark",sides=9)
    if GRAZER_MOTION and STYLE=="tapir":
        s.start("Soft tapered proboscis")
        s.tube([(muzzle+V((0,.086,-.012)),.13,.091,{"head":1}),
                (muzzle+V((0,.240,-.06)),.104,.088,{"head":1}),
                (muzzle+V((0,.299,-.167)),.058,.053,{"head":1}),
                (muzzle+V((0,.315,-.215)),.034,.040,{"head":1})],
               head_color,sides=12)
    elif STYLE in ("pig","warthog","saiga","tapir"):
        p=muzzle+V((0,SNOUT*.32,-.039 if STYLE!="pig" else 0))
        s.ellipsoid(p,(muzzle_w*.71,SNOUT*.30,head_r*.39),"head",
                    lambda p,n:"muzzle",sides=11,steps=7)
        for _,sign in SIDES:
            s.ellipsoid(p+V((sign*muzzle_w*.31,SNOUT*.26,.012)),(.027,.022,.027),"head",
                        lambda p,n:"ink",sides=8,steps=5)
    for side,sign in SIDES:
        eye=HEAD+V((sign*head_r*.79,SNOUT*.27,head_r*.34))
        s.ellipsoid(eye,(.051,.063,.062),"head",lambda p,n:"blaze" if n.z>.85 and n.y>.29 else "ink",sides=10,steps=6)
        s.start("Ear "+side)
        pivot=EARS[side]
        bone=f"ear.{side}"
        long=.45 if (FARM_ROLLOUT or GRAZER_MOTION) and STYLE=="long-ears" else .33 if STYLE in ("long-ears","fleece","okapi","doe") else .20
        if FARM_ROLLOUT and STYLE=="wool":
            s.ellipsoid(pivot+V((sign*.129,-.036,.016)),(.164,.076,.069),bone,
                        lambda p,n:"muzzle",sides=13,steps=8)
        elif STYLE=="elephant":
            s.ellipsoid(pivot+V((sign*.23,-.042,-.025)),(.355,.14,.46),bone,
                        lambda p,n:band(n,"muzzle" if n.y>.47 else "coat"),sides=14,steps=10)
        elif GRAZER_MOTION and STYLE=="tapir":
            p = pivot+V((sign*.074,-.036,.067))
            s.ellipsoid(p,(.102,.062,.126),bone,lambda p,n:"blaze" if n.z>.67 else
                        "ink" if n.y>.35 else "coat",sides=12,steps=8)
        elif STYLE in ("bear","panda","mouse","koala","chinchilla","guinea","hamster","aye","hyena","long-quill"):
            big=STYLE in ("mouse","koala","chinchilla","aye")
            p=pivot+V((sign*(.072 if big else .023),-.036,.063))
            r=.159 if big else .130 if STYLE=="hyena" else .076 if STYLE=="long-quill" else .106
            s.ellipsoid(p,(r,.072,r*.91),bone,lambda p,n:"muzzle" if n.y>.52 else
                        "ink" if STYLE=="panda" else band(n),sides=11,steps=7)
        else:
            long_ear = (FARM_ROLLOUT or GRAZER_MOTION) and STYLE=="long-ears"
            s.tube([(pivot,.089,.062,{bone:1}),
                    (pivot+V((sign*.101,-.046,long*.38)),.104,.062,{bone:1}),
                    (pivot+V((sign*(.103 if STYLE=="doe" else .17),-.074,long*.73)),.065,.041,{bone:1}),
                    (pivot+V((sign*(.119 if STYLE=="doe" else .184 if long_ear else .224),-.09,long)),.013,.014,{bone:1})],
                   lambda p,n:"ink" if long_ear and p.z>pivot.z+.39 else
                   "muzzle" if n.y>.57 and abs(p.x-pivot.x)<.20 else band(n),sides=9)
        if STYLE in ("cow","goat","gemsbok","gazelle","lyre","springbok","saiga","gerenuk","bison","buffalo","musk",
                     "wildebeest","palm","antlers"):
            s.start("Horn or antler "+side)
            horn=HEAD+V((sign*head_r*.55,-.077,head_r*.71))
            height=.48 if STYLE in ("gemsbok","lyre","antlers","palm") else .31
            spread=.33 if STYLE in ("buffalo","musk","palm","bison","wildebeest") else .17
            if GRAZER_MOTION and STYLE=="gemsbok":
                height,spread=.86,.10
            if GRAZER_MOTION and STYLE=="palm":
                height,spread=.42,.46
            middle=horn+V((sign*spread*.58,-.085,height*.58))
            end=horn+V((sign*spread,-.213 if STYLE=="gemsbok" else -.095,height))
            s.tube([(horn,.069,.063,{"head":1}),(middle,.050,.049,{"head":1}),(end,.011,.012,{"head":1})],
                   lambda p,n:"feature",sides=9)
            if STYLE in ("palm","antlers"):
                if STYLE=="palm":
                    paddle=(.233,.052,.165) if GRAZER_MOTION else (.168,.070,.221)
                    s.ellipsoid(middle.lerp(end,.55),paddle,"head",lambda p,n:"feature",sides=9,steps=7)
                for i in range(3):
                    a=middle.lerp(end,i*.34)
                    b=a+V((sign*(.125+.028*i),-.07+.063*i,.17))
                    s.tube([(a,.032,.034,{"head":1}),(b,.009,.010,{"head":1})],
                           lambda p,n:"feature",sides=7)
        if STYLE=="giraffe":
            p=HEAD+V((sign*head_r*.45,-.037,head_r*.72))
            s.tube([(p,.048,.045,{"head":1}),(p+V((sign*.021,-.01,.185)),.039,.043,{"head":1})],
                   lambda p,n:"feature",sides=8)
        if STYLE in ("elephant","warthog"):
            start=muzzle+V((sign*muzzle_w*.72,SNOUT*.26,-.10))
            reach=.40 if STYLE=="elephant" else .22
            s.tube([(start,.076,.067,{"head":1}),
                    (start+V((sign*.029,reach*.51,-.028)),.053,.045,{"head":1}),
                    (start+V((sign*.074,reach,.079)),.010,.011,{"head":1})],
                   lambda p,n:"feature",sides=9)
    if STYLE=="elephant":
        s.start("Curving articulated trunk")
        for i in range(len(TRUNK)-1):
            a,b=TRUNK[i],TRUNK[i+1]
            bone=f"trunk{i}"
            r=.178-.035*i
            s.tube([(a,r,r,{"head":.40,bone:.60} if not i else {f"trunk{i-1}":.38,bone:.62}),
                    (a.lerp(b,.66),r*.87,r*.88,{bone:1}),
                    (b,r*.72,r*.74,{bone:1})],
                   lambda p,n:band(n),sides=12)
    if STYLE=="rhino":
        s.start("Two nasal horns")
        for offset,height in ((.28,.38),(.05,.20)):
            p=muzzle+V((0,offset,head_r*.34))
            s.tube([(p,.121,.104,{"head":1}),
                    (p+V((0,.01,height*.64)),.059,.053,{"head":1}),
                    (p+V((0,-.052,height)),.009,.011,{"head":1})],
                   lambda p,n:"feature",sides=10)
    for name,(a,b,c) in LEGS.items():
        s.start("Articulated leg "+name)
        upper,lower,paw=f"{name}.upper",f"{name}.lower",f"{name}.hoof"
        r=WIDTH*(.37 if STYLE in ("hippo","rhino","elephant") else .29)
        narrow=max(.052,r*.53)
        leg_profile=[(a+V((0,0,.107)),r*.72,r,{"body":.46,upper:.54}),
                (a,r,r*1.23,{upper:1}),(a.lerp(b,.59),r*.80,r*.92,{upper:1}),
                (b,r*.62,r*.65,{upper:.52,lower:.48}),
                (b.lerp(c,.68),narrow,narrow*1.04,{lower:1}),
                (c,narrow*.82,narrow*.90,{lower:.49,paw:.51})]
        if GRAZER_MOTION and STYLE=="okapi":
            leg_profile=[
                (p.lerp(q,t),rx+(sx-rx)*t,ry+(sy-ry)*t,
                 {bone: weights.get(bone,0)*(1-t)+next_weights.get(bone,0)*t
                  for bone in sorted(weights.keys()|next_weights.keys())})
                for (p,rx,ry,weights),(q,sx,sy,next_weights) in zip(leg_profile,leg_profile[1:])
                for t in (0,.2,.4,.6,.8)
            ]+[leg_profile[-1]]
        s.tube(leg_profile,
               lambda p,n:"dark" if FARM_ROLLOUT and (STYLE=="wool" or
                   STYLE in ("mane","long-ears") and p.z<LEG*.47) else
               ("blaze" if math.cos(p.z*44)>.10 else "ink") if GRAZER_MOTION and STYLE=="okapi" and p.z<LEG*.91 else
               "ink" if STYLE in ("zebra","okapi") and math.cos(p.z*33)>.37 else
               "blaze" if STYLE=="okapi" and p.z<.57 else
               "hoof" if STYLE in ("hyena","long-quill") and p.z<.34 else band(n),
               sides=10)
        if PAWED:
            tone="ink" if STYLE in ("fox","panda","red-panda","hyena","long-quill") else "dark"
            s.ellipsoid(c+V((0,.051,-.047)),(narrow*1.42,narrow*1.68,.073),paw,
                        lambda p,n:band(n,tone),sides=10,steps=6)
        else:
            s.ellipsoid(c+V((0,.059,-.049)),(narrow*1.22,narrow*1.6,.077),paw,
                        lambda p,n:"hoof" if n.dot(LIGHT)<.62 else "dark",sides=10,steps=6)
    s.start("Tail and tuft")
    if STYLE=="doe":
        s.ellipsoid(TAIL+V((0,-.19,-.009)),(.146,.234,.11),"tail",
                    lambda p,n:"blaze" if n.z<-.09 or p.y<TAIL.y-.29 else band(n),
                    sides=14,steps=8)
        return s
    if FARM_ROLLOUT and STYLE=="pig":
        p = TAIL
        coil = [p+V((.122*math.sin(k*.72),-.064*k,.132*(1-math.cos(k*.72)))) for k in range(9)]
        s.tube([(point,.052-.004*i,.050-.004*i,{"tail":1}) for i,point in enumerate(coil)],
               lambda p,n:band(n,"muzzle"),sides=9)
        return s
    if FARM_ROLLOUT and STYLE=="mane":
        s.tube([(TAIL,.092,.089,{"tail":1}),
                (TAIL+V((0,-.24,-.13)),.118,.117,{"tail":1}),
                (TAIL+V((0,-.51,-.36)),.140,.137,{"tail":1}),
                (TAIL+V((0,-.67,-.62)),.108,.108,{"tail":1}),
                (TAIL+V((0,-.72,-.82)),.034,.047,{"tail":1})],
               lambda p,n:"ink" if n.dot(LIGHT)<.38 else "hoof",sides=13)
        return s
    reach=.34 if STYLE in ("pig","hippo","tapir","musk") else .58 if STYLE in ("mane","zebra","elephant") else .45
    if STYLE in ("mouse","opossum","otter","longtail","coati","raccoon","fox","wolf","red-panda","anteater"):
        reach=.95 if STYLE in ("mouse","opossum","longtail","coati","anteater") else .69
    elif STYLE in ("bear","panda","wombat","koala","guinea","hamster","capybara"):
        reach=.17
    upright=STYLE in ("skunk","squirrel","chinchilla","coati")
    end=TAIL+V((0,-reach,.72 if upright else .13 if STYLE=="antlers" else -.20 if PAWED else -.34))
    wide=.221 if STYLE in ("fox","red-panda","squirrel","anteater","skunk","chinchilla") else .129 if STYLE in ("wolf","raccoon","otter") else .07 if STYLE in ("mouse","opossum") else .106
    if GRAZER_MOTION and STYLE in ("chinchilla","quokka"):
        end=TAIL+V((0,-.52,.21 if STYLE=="chinchilla" else .10))
        wide=.127 if STYLE=="chinchilla" else .079
    def tail_color(p,n):
        if GRAZER_MOTION and STYLE in ("mouse","opossum"):
            return band(n) if p.y>TAIL.y-.09 else "muzzle"
        if STYLE in ("raccoon","red-panda","coati") and math.cos((p.y+p.z)*21)>.23:
            return "ink" if STYLE=="raccoon" else "dark"
        if STYLE in ("fox","skunk") and ((end-p).length<.17 or STYLE=="skunk" and n.z>.34):
            return "blaze"
        return "feature" if p.y<end.y+.095 else band(n)
    s.tube([(TAIL,wide*.68,.091,{"tail":1}),
            (TAIL.lerp(end,.48)+V((0,-.09,.069 if upright else .034)),wide,wide*.91,{"tail":1}),
            (TAIL.lerp(end,.83),wide*.72,wide*.68,{"tail":1}),
            (end,.035,.039,{"tail":1})],tail_color,sides=10)
    if STYLE in ("paddle","platypus"):
        s.ellipsoid(TAIL+V((0,-.37,-.27)),(.226,.48,.071),"tail",
                    lambda p,n:band(n,"muzzle" if STYLE=="platypus" else "dark"),sides=12,steps=8)
    if STYLE in ("mane","zebra","bison","elephant","wildebeest","antlers","hyena"):
        s.ellipsoid(end,(.083,.15,.107),"tail",lambda p,n:"blaze" if has_white_tail() else "feature",sides=10,steps=7)
    return s


def has_white_tail():
    return STYLE=="antlers" and WIDTH<.40


def farm_pose(rig,rest,clip,t):
    wave = math.tau*t
    pulse = math.sin(math.pi*t)**2
    stepping = clip in ("walk","flee","ride","ride-sprint")
    gallop = clip in ("flee","ride-sprint")
    ridden = clip in ("ride","ride-sprint")
    crouch = t if clip=="lie" else 1-t if clip=="stand" else 1 if clip in ("ruminate","roll") else 0
    ground_feed = STYLE in ("cow","mane")
    graze = 0
    rear = 0
    if ground_feed:
        graze = t if clip=="lower" else 1-t if clip=="raise" else float(clip in ("graze","drink"))
    elif STYLE=="goat":
        rear = t if clip=="rear" else 1-t if clip=="lower" else float(clip=="browse")
    elif STYLE=="pig":
        graze = (.57+.13*math.sin(2*wave))*pulse if clip=="sniff" else (
            .73+.24*math.sin(3*wave) if clip=="root" else .59*pulse if clip=="pickup" else 0
        )
    hop = pulse if clip=="hop" else 0
    roll = math.sin(wave*.5)**2 * (math.pi*.96 if clip=="roll" else 0)
    bob = (.073 if gallop else .043)*math.cos(2*wave)*stepping
    if ridden:
        bob *= .48
    pitch = .06*math.sin(wave)*stepping+.32*rear-.106*graze
    roll_q = euler(pitch,roll+.037*math.sin(wave)*stepping,0)
    lowered = max(.07,LEG-.115)*crouch
    body = transform(roll_q,BODY,BODY+V((.026*math.sin(wave),0,
                     bob+.023*math.sin(wave)-lowered+.10*rear+.05*hop+.095*math.sin(roll))))
    out = {"body":body@rest["body"]}
    chew = (.11+.099*math.sin(3*wave)) if clip in ("graze","ruminate","eat") else 0
    drink = (.09+.075*math.sin(4*wave)) if clip=="drink" else 0
    shake = .18*math.sin(2*wave)*pulse if clip=="action" else 0
    bleat = .44*pulse if clip=="bleat" else 0
    hq = roll_q@euler(-.62*graze+.21*rear+.069*math.sin(wave)-.13*bleat,
                     0,shake+.06*math.sin(wave)*float(clip=="idle"))
    muzzle_drop = (NECK*.76+LEG*.51) if ground_feed else .28
    dip = muzzle_drop*graze+.068*drink
    h = transform(hq,HEAD,body@HEAD+V((0,.21*graze,-dip+.061*bleat)))
    out["head"] = h@rest["head"]
    jaw = chew+drink+.39*bleat+.32*pulse*float(clip=="pickup")+.105*pulse*float(clip=="browse")
    out["jaw"] = transform(hq@euler(-jaw),JAW,h@JAW)@rest["jaw"]
    out["tail"] = transform(roll_q@euler(.14*math.sin(wave)+.21*gallop,0,
                            (.27 if stepping else .12)*math.sin(wave)),
                            TAIL,body@TAIL)@rest["tail"]
    for side,sign in SIDES:
        origin = EARS[side]
        flap = (.21 if clip=="action" else .074)*math.sin(wave+sign*.85)
        name = f"ear.{side}"
        out[name] = transform(hq@euler(flap,sign*flap,0),origin,h@origin)@rest[name]
    for name,(a,b,c) in LEGS.items():
        fore = name.startswith("fore")
        left = name.endswith(".l")
        phase = ((.06 if fore else .42)+(.16 if left else 0)) if gallop else (
            .53*left+.25*fore+(.10 if ridden else 0)
        )
        length,lift = stride(t,phase,.42 if gallop else .32 if ridden else .23,
                            .245 if gallop else .136 if ridden else .095) if stepping else (0,0)
        foot = c+V((0,length+(.24 if not fore else -.24)*crouch,
                    lift+(.37 if fore else .028)*rear+(.13 if fore else .08)*hop))
        if clip=="roll":
            foot = body@(c+V((0,(-.23 if fore else .20),LEG*.57)))
        up,dn,paw = name+".upper",name+".lower",name+".hoof"
        hip = body@a
        bend_vector = V((0,-1 if fore else 1,0))
        if clip=="roll":
            bend_vector = roll_q@bend_vector
        knee,ankle = solve_knee(hip,foot,rig.data.bones[up].length,rig.data.bones[dn].length,bend_vector)
        out[up] = aimed(rest[up],hip,knee)
        out[dn] = aimed(rest[dn],knee,ankle)
        rotate = (roll_q if clip=="roll" else euler())@euler(-.42*lift+.18*rear*fore)
        out[paw] = transform(rotate,c,ankle)@rest[paw]
    return out


def pose(rig,rest,clip,t):
    if FARM_ROLLOUT:
        return farm_pose(rig,rest,clip,t)
    if GRAZER_MOTION:
        return grazer_pose(rig,rest,clip,t)
    wave=math.tau*t
    walk=clip in ("walk","stalk")
    bob=.049*math.cos(wave*2) if walk else .022*math.sin(wave)
    gesture=math.sin(math.pi*t)**2
    graze=(
        t if clip=="lower" else 1-t if clip=="raise" else
        .83+.17*math.sin(wave*3) if clip=="browse" else
        .77*gesture if clip in ("eat","root","pickup","sniff","ruminate","feed","dig","build") else 0
    )
    settle=(
        t if clip=="lie" else 1-t if clip=="stand" else
        .69+.26*gesture if clip in ("roll","ruminate","curled","sleep","settle") else
        t if clip=="curl-in" else 1-t if clip=="uncurl" else 0
    )
    rear = gesture if clip in ("rear","alarm","display") else 0
    alert = rear if STYLE=="hyena" else 0
    rear -= alert
    hop = gesture if clip in ("hop","pounce") else 0
    stalk=.13 if clip=="stalk" else 0
    q=euler(.051*math.sin(wave)*walk-.09*graze+.42*rear,
            .035*math.sin(wave)*walk+.37*settle*(clip=="roll"),0)
    body=transform(q,BODY,BODY+V((0,.063*graze,bob-LEG*.59*settle+.19*rear+.19*hop-stalk)))
    output={"body":body@rest["body"]}
    headq=q@euler((-.97 if STYLE=="hyena" else -.76)*graze+.13*gesture*(clip in ("action","bleat","reach"))-.37*rear+.26*alert,
                 0,.20*math.sin(wave) if clip in ("idle","shake","action","listen","scan","rattle") else .023*math.sin(wave))
    dip=.52 if STYLE=="hyena" else .27
    head=transform(headq,HEAD,body@HEAD+V((0,.085*graze,-(NECK*.58+dip)*graze+.15*alert)))
    output["head"]=head@rest["head"]
    output["tail"]=transform(q@euler(.13*math.sin(wave),0,.31*math.sin(wave)),TAIL,body@TAIL)@rest["tail"]
    for side,sign in SIDES:
        pivot=EARS[side]
        ear_motion=(.25 if clip=="shake" else .087)*math.sin(wave+sign*.93)
        output[f"ear.{side}"]=transform(headq@euler(0,sign*ear_motion,ear_motion),pivot,head@pivot)@rest[f"ear.{side}"]
    for name,(a,b,c) in LEGS.items():
        fore=name.startswith("fore")
        phase=(.27 if fore else 0)+(0 if name.endswith(".l") else .50)
        stride_gain=.09 if STYLE in ("hyena","long-quill") else 0
        advance,lift=stride(t,phase,.29+LEG*.07+stride_gain,.106+LEG*.036+stride_gain*.55) if walk else (0,0)
        if clip=="swim":
            advance=.26*math.sin(wave+phase*math.tau)
            lift=.17+.08*math.cos(wave+phase*math.tau)
        if hop:
            advance+=(.20 if fore else -.27)*hop
        if clip=="stamp" and name=="fore.l":
            advance=.12*gesture
            lift=.24*gesture
        adduct=LEG*.34*settle
        target=c+V((0,advance+(-adduct if fore else adduct),lift+.28*rear*fore+.14*hop))
        up,down,paw=f"{name}.upper",f"{name}.lower",f"{name}.hoof"
        hip=body@a
        knee,ankle=solve_knee(hip,target,rig.data.bones[up].length,rig.data.bones[down].length,V((0,-1 if fore else 1,0)))
        output[up]=aimed(rest[up],hip,knee)
        output[down]=aimed(rest[down],knee,ankle)
        output[paw]=transform(euler(lift*-.74),V((0,0,0)),ankle)
    if STYLE=="long-quill":
        flare=gesture if clip in ("quills","action","relax") else .62+.22*math.sin(wave*3) if clip=="rattle" else 0
        if clip=="relax":
            flare=1-t
        for side,sign in SIDES:
            pivot=BODY+V((sign*.17,-.06,.18))
            output[f"quills.{side}"]=transform(q@euler(-.48*flare,sign*.26*flare,0),pivot,body@pivot)@rest[f"quills.{side}"]
    if STYLE=="elephant":
        p=head@TRUNK[0]
        amount=(.61 if clip=="curl" else .50 if clip in ("reach","eat") else .13)*gesture
        for i,(a,b) in enumerate(zip(TRUNK,TRUNK[1:])):
            d=headq@(euler(-amount*(i+1),.11*math.sin(wave+i*.53),0)@(b-a))
            name=f"trunk{i}"
            output[name]=aimed(rest[name],p,p+d)
            p+=d
    return output


def grazer_pose(rig, rest, clip, t, motion=None):
    depth, reach, bound = GRAZER_MOTION if motion is None else motion
    wave = math.tau*t
    fleeing = clip == "flee"
    mounted = clip in ("ride","ride-sprint")
    quick = fleeing or clip=="ride-sprint"
    walking = clip == "walk" or mounted
    stride_motion = walking or fleeing
    gesture = math.sin(math.pi*t)**2
    doe = STYLE=="doe"
    transition = t*t*(3-2*t)
    graze = {"lower":transition, "browse":1, "raise":1-transition}.get(clip,0) if doe else (
        gesture if clip=="action" else 0
    )
    chew = math.sin(3*wave)*graze if not doe or clip=="browse" else 0
    alert = gesture if doe and clip in ("action","stamp") else 0
    stamp = math.sin(math.pi*min(t/.76,1))**2 if clip=="stamp" else 0
    sway = math.sin(wave)
    bob = bound*.44*math.cos(2*wave) if fleeing else .031*math.cos(2*wave) if walking else .014*sway
    if mounted:
        bob *= .52
    body_rotation = euler(.17*sway if fleeing else .035*sway-.077*graze+.061*stamp,
                          .036*sway*stride_motion, 0)
    body = transform(body_rotation, BODY, BODY+V((0, 0, bob-.040*graze)))
    out = {"body": body@rest["body"]}
    head_rotation = body_rotation@euler(-depth*graze+.03*chew+.052*math.cos(wave)+.12*alert,
                                        0, .047*sway+(reach*.19)*graze-.16*alert)
    head = transform(head_rotation, HEAD,
                     body@HEAD+V((0, reach*graze, -depth*(.53 if doe else 1)*graze+.022*chew+.045*alert)))
    out["head"] = head@rest["head"]
    if STYLE=="giraffe":
        head_rotation,head=giraffe_head(rest,out,body,body_rotation,clip,t)
        out["head"]=head@rest["head"]
    if STYLE=="elephant":
        elephant_trunk(rest,out,head,head_rotation,clip,t)
    tail = body_rotation@euler((-.60 if doe else .31)*fleeing+.081*math.sin(2*wave)-.24*alert,
                               0, .18*sway)
    out["tail"] = transform(tail, TAIL, body@TAIL)@rest["tail"]
    for side, sign in SIDES:
        pivot = EARS[side]
        twitch = (.15 if clip == "idle" else .064)*math.sin(wave+sign*.93)
        name = f"ear.{side}"
        out[name] = transform(head_rotation@euler(twitch, sign*twitch, 0), pivot, head@pivot)@rest[name]
    for name, (hip, _, hoof) in LEGS.items():
        fore = name.startswith("fore")
        right = name.endswith(".r")
        phase = (.40*fore+.15*right) if quick else (.25*fore+.50*right)
        if STYLE=="hump":
            phase = (.10 if clip=="ride" else .16 if quick else .33)*fore+.50*right
        advance, lift = (0, 0)
        if stride_motion:
            if PAWED:
                advance,lift = stride(t,phase,.135+bound*.80 if quick else .13+LEG*.11,
                                      .052+bound*.42 if quick else .045+LEG*.069)
            else:
                advance,lift = stride(t,phase,.29+bound*.62 if quick else .31 if mounted else .19+LEG*.065,
                                      bound+.047 if quick else .066 if mounted else .069+LEG*.041)
        if name=="fore.l" and stamp:
            advance,lift = .19*stamp,.27*stamp
        raised_hoof = hoof+V((0, advance, lift))
        upper, lower, foot = f"{name}.upper", f"{name}.lower", f"{name}.hoof"
        moved_hip = body@hip
        knee, ankle = solve_knee(moved_hip, raised_hoof, rig.data.bones[upper].length,
                                 rig.data.bones[lower].length, V((0, -1 if fore else 1, 0)))
        out[upper] = aimed(rest[upper], moved_hip, knee)
        out[lower] = aimed(rest[lower], knee, ankle)
        out[foot] = transform(euler(-.52*lift), hoof, ankle)@rest[foot]
    return out


def giraffe_head(rest,out,body,body_rotation,clip,t):
    wave=math.tau*t
    ramp=t*t*(3-2*t)
    extension={"reach":ramp,"browse":1,"lower":1-ramp}.get(clip,0)
    base,middle,end=giraffe_neck()
    start=body@base
    rhythm=(.06 if clip=="flee" else .034)*math.sin(2*wave)
    grazing=.043*math.sin(wave*3) if clip=="browse" else 0
    glance=.18*math.sin(math.pi*t)**2 if clip=="action" else 0
    lower_rotation=body_rotation@euler(-1.04*extension+rhythm,0,glance)
    upper_rotation=body_rotation@euler(-1.63*extension+rhythm*.55+grazing,0,.064*extension+glance)
    elbow=start+lower_rotation@(middle-base)
    skull=elbow+upper_rotation@(end-middle)
    out["neck.base"]=aimed(rest["neck.base"],start,elbow)
    out["neck.upper"]=aimed(rest["neck.upper"],elbow,skull)
    q=body_rotation@euler(-.19*extension+grazing*1.8+rhythm,0,glance)
    return q,transform(q,HEAD,skull)


def elephant_trunk(rest,out,head,head_rotation,clip,t):
    wave=math.tau*t
    ramp=t*t*(3-2*t)
    pulse=math.sin(math.pi*t)**2
    pitch={
        "action":(.30*pulse,.58*pulse,1.21*pulse),
        "reach":(.67*ramp,1.43*ramp,1.62*ramp),
        "curl":(.67+.28*ramp,1.43+.62*ramp,1.62+1.10*ramp),
        "eat":(.95,2.05+.14*math.sin(wave*3),2.72+.12*math.sin(wave*3)),
        "shake":(.66+.14*math.sin(wave*3),1.08+.27*math.sin(wave*3),1.23+.28*math.sin(wave*3)),
    }.get(clip,(.088,.17,.26))
    sweep=.25*math.sin(wave*3)*pulse if clip=="shake" else .073*math.sin(wave)
    p=head@TRUNK[0]
    for i,(a,b) in enumerate(zip(TRUNK,TRUNK[1:])):
        d=head_rotation@(euler(pitch[i]+.049*math.sin(wave-i*.44),sweep*(i+1),0)@(b-a))
        bone=f"trunk{i}"
        out[bone]=aimed(rest[bone],p,p+d)
        p+=d
