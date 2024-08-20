+++
title = "Chris's x0xb0x"
date = "2024-08-20T04:33:28-07:00"
author = "Milo"
authorTwitter = "" #do not include @
cover = ""
tags = ["synthrepair", "303", "xox"]
keywords = ["xox", "x0x", "x0xb0x", "xoxbox", "303","tb-303"]
description = "Panasonic Potentiometer Pain."
showFullContent = false
readingTime = false
hideComments = false
color = "" #color from the theme settings
toc = true
+++

## Chris' x0xb0x

This early x0xb0x build came into the bench a little while ago. The problems were:  
- scratchy pots on volume, resonance, and cutoff freq
- dead zone at most CW point of cutoff freq
- scratchy boost toggle switch

TL;DR: There was corrosion that the client wanted to deal with later. The pots were damaged and long-obsolete; sourcing replacements invited research, shared here.

Photos WIP, will come one day

### Opening it up
Inside, there were further issues-- some building corrosion across the board. We decided to clean it for now, and assess next steps in the future when it fails. The x0x (and 303) have no battery but do have persistent digital sequence memory. The power is regulated by a capacitor, perhaps the ultimate source of the corrosion. We'll replace that and any other suspect caps just in case. No memory issues yet, so it could have originated elswhere. 

### Pot cleaning & Knob troubles

Cleaning all scratchy pots had some effect, but not enough. I think the damage was ultimately sourced by the wrong knobs. The knob caps had knurled sleeves, but the potentiometers were all flatted. The knob caps were forced onto the pots, and took considerable effort to remove. It is likely that the force required to install them (and probably remove and reinstall x times) affected to mid-long term reliability of the pots. The force certaily caused the dead zone on the frequency pot, whose housing was bent, causing the pot to leave the carbon track at the final CW degrees.

Easy enough, put different knobs on. But the knobs were nice and silver, a good match for a 303 clone. So I sought stock of pots with knurled actuators.

On close inspection, the knobs on this unit didn't match any x0x BOM I'd found. The board was sure to be from the [first or second runs](https://www.ladyada.net/make/x0xb0x/index.html) of the x0x from the marks on the silkscreen vs the gallery shots. 

This unit had 3 "G" Taper type pots (50KG marked), which I had never seen. 

### Pot replacements

The [original BOM](https://www.ladyada.net/make/x0xb0x/fab/parts.html) included long-defunct Panasonic pots EVU-F series [(Datasheet)](https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/9/EVUE_F.pdf). The taper was not clarified by the datasheet, but I was able to dig up this [old Panasonic doc](https://industrial.panasonic.com/cdbs/www-data/pdf/AOK0000/AOK0000PE1.pdf), revealing that G type is curved Linear taper, a bit of an S shape. Grand. 

Per the BOM-- and all documents and discussion I could find-- pots VR3, 5, 6 and 7 are log pots, and VR2, 4 and 7 are linear. However, on this unit, VR8 was a G pot, so the volume knob was a linear one. Lets say its safe to assume this is wrong. The S-curve pots will be fine with linear pots to replace, so all else can be 1 to 1.

I spent too much time on Taper charts, [forums debating the superior knobs](https://modwiggler.com/forum/viewtopic.php?t=187925), and [the evolution thread for the BOM](https://forums.adafruit.com/viewtopic.php?t=3304&start=60) and then just let shipping and availability (knurled, remember) settle it for me with Bourns PVT series [PTV09](https://www.bourns.com/docs/Product-Datasheets/PTV09.pdf) and [PTV112](https://www.bourns.com/docs/Product-Datasheets/PTVPTT.pdf) for the dual gang pot. Will report back with results. If its not good enough, we can shell out for a couple alps pots. It should be fine. 

### Noisy switch

The switch is a dual gang switch wired (and hot glued) directly to 4 polyester caps. Should have some at home to make a new switch and hot swap, and see if a On-On switch with 0 dead zone is possible. Kind of a pain.

## Next Steps
- Get home from travel, order the pots
- Determine which caps to toss in or find my old notes lol\
- Clean! Unfortunately, this BA662 and BA661s days are numbered, regardless. We'll burn that bridge when we come to it. It may be too expensive to repair, alas. 
