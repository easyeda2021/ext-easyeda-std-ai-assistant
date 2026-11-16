/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * parts.js — 常用器件模板（原始 EasyEDA 符号源码，一行一个）
 *
 * P.RAW[key] 是原样的 LIB 源码串；放置时才解码为 createShape 需要的
 * jsonCache，并就地修改坐标 / 位号 / 值 / 封装，不需要参数化建模。
 *
 * 由 tmp/gen-parts.py 从 tmp/common-parts.json 生成；
 * 增删常用件只改脚本里的 PICKS，然后重新生成。
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var P = (EAI.parts = {});

	P.RAW = {
		"R": "LIB~240~-775~package`R0805`nameAlias`Value(Ω)`Supplier Part``Supplier``Contributor`LCEDA_Lib`spicePre`R`spiceSymbolName`R_0805_US`Manufacturer Part``~~0~gge6e59fded17a49b6b~b60f399a7a7e41848b2be1eb49c79141~9698a5ebc38f435fb5a5f9ff5b84927c~0~~yes~yes~~1586861910~#@$T~N~233.86~-783~0~#000080~Arial~~~~~comment~1k~1~start~gge226~0~#@$T~P~233.86~-791.85~0~#000080~Arial~~~~~comment~R1~1~start~gge235~0~#@$PL~255 -775 252 -770~#A00000~1~0~none~gge241~0#@$PL~247 -780 242 -770~#A00000~1~0~none~gge244~0#@$PL~252 -770 247 -780~#A00000~1~0~none~gge247~0#@$P~show~0~2~260~-775~0~gge250~0^^260~-775^^M 260 -775 h -5~#800^^0~251~-775~0~2~end~~~#800^^0~259~-779~0~2~start~~~#800^^0~258~-775^^0~M 255 -778 L 252 -775 L 255 -772#@$PL~233 -770 228 -780~#A00000~1~0~none~gge271~0#@$PL~242 -770 238 -780~#A00000~1~0~none~gge274~0#@$PL~238 -780 233 -770~#A00000~1~0~none~gge277~0#@$PL~228 -780 225 -775~#A00000~1~0~none~gge280~0#@$P~show~0~1~220~-775~180~gge283~0^^220~-775^^M 220 -775 h 5~#800^^0~229~-775~0~1~start~~~#800^^0~221~-779~0~1~end~~~#800^^0~222~-775^^0~M 225 -772 L 228 -775 L 225 -778",
		"C": "LIB~240~-710~package`C0805`nameAlias`Value(F)`Supplier Part``Supplier``Contributor`LCEDA_Lib`spicePre`C`spiceSymbolName`C_0805_US`Manufacturer Part``~~0~gge33e1d4e7c0121bd1~2ee8eb13a0124a108e622ce40c0c25a8~b82150387a2041b4afd55b90c79c5923~0~~yes~yes~~1586863213~#@$T~N~234.03515625~-721~0~#000080~Arial~~~~~comment~0.1u~1~start~gge613~0~#@$T~P~234.03515625~-730~0~#000080~Arial~~~~~comment~C1~1~start~gge619~0~#@$PL~238 -702 238 -718~#A00000~1~0~none~gge625~0#@$P~show~0~1~220~-710~180~gge628~0^^220~-710^^M 230 -710 h -10~#800^^0~234~-710~0~1~start~~~#800^^0~226~-714~0~1~end~~~#800^^0~207~-710^^0~M 210 -707 L 213 -710 L 210 -713#@$PL~250 -710 242 -710~#A00000~1~0~none~gge649~0#@$PL~242 -718 242 -702~#A00000~1~0~none~gge652~0#@$P~show~0~2~260~-710~0~gge655~0^^260~-710^^M 250 -710 h 10~#800^^0~246~-710~0~2~end~~~#800^^0~254~-714~0~2~start~~~#800^^0~273~-710^^0~M 270 -713 L 267 -710 L 270 -707#@$PL~238 -710 230 -710~#A00000~1~0~none~gge676~0",
		"C_TAN": "LIB~305~-710~package`CASE-A_3216`nameAlias`Value(F)`Supplier Part``Supplier``Contributor`LCEDA_Lib`spicePre`C`spiceSymbolName`C_Tan_SMD_A_US`Manufacturer Part``~~0~ggea8edea5c744525b8~ce25118ef0b041b8a773e71ca28ae65d~a7a0e276dadd4f8097422d2afc2e1b9c~0~~yes~yes~~1586863438~#@$T~N~299.03515625~-723~0~#000080~Arial~~~~~comment~1u~1~start~gge751~0~#@$T~P~299.03515625~-732~0~#000080~Arial~~~~~comment~C2~1~start~gge757~0~#@$P~show~0~1~285~-710~0~gge763~0^^285~-710^^M 285 -710 h 17~#8D2323^^0~305~-707~0~1~start~~~#8D2323^^0~296~-711~0~1~end~~~#8D2323^^0~305~-710^^0~M 302 -713 L 299 -710 L 302 -707#@$P~show~0~2~325~-710~180~gge784~0^^325~-710^^M 325 -710 h -19~#8D2323^^0~303~-707~0~2~end~~~#8D2323^^0~312~-711~0~2~start~~~#8D2323^^0~303~-710^^0~M 306 -707 L 309 -710 L 306 -713#@$PL~302 -720 302 -700~#8D2323~1~0~none~gge805~0#@$A~M 306 -710 A 16.0836 16.0836 0 0 0 309 -700~~#8D2323~1~0~none~gge808~0#@$A~M 309 -720 A 16.2917 16.2917 0 0 0 306 -710~~#8D2323~1~0~none~gge811~0#@$R~297~-717~~~0.1~4~#8D2323~1~0~#8D2323~gge814~0~#@$R~295~-715~~~4~0.1~#8D2323~1~0~#8D2323~gge817~0~",
		"L": "LIB~240~-665~package`L0603`nameAlias`Value(H)`Supplier Part``Supplier``Contributor`LCEDA_Lib`spicePre`L`spiceSymbolName`L0603_US`Manufacturer Part``~~0~ggeb8c8704ac7f20f7b~1f261cf72cb1479ca32177c31156ede3~a4eacdcb63554cb08b3b56477817ab57~0~~yes~yes~~1586864032~#@$T~N~234.80859375~-672.33~0~#000080~Arial~~~~~comment~1m~1~start~gge895~0~#@$T~P~234.80859375~-681.33~0~#000080~Arial~~~~~comment~L1~1~start~gge901~0~#@$P~show~0~2~260~-665~0~gge907~0^^260~-665^^M 260 -665 h -3~#800^^0~253~-665~0~2~end~~~#800^^0~261~-669~0~2~start~~~#800^^0~260~-665^^0~M 257 -668 L 254 -665 L 257 -662#@$P~show~0~1~220~-665~180~gge928~0^^220~-665^^M 220 -665 h 3~#800^^0~227~-665~0~1~start~~~#800^^0~219~-669~0~1~end~~~#800^^0~220~-665^^0~M 223 -662 L 226 -665 L 223 -668#@$A~M 223.117 -665.068 A 4 3.9 0 1 1 231.082 -665.064~~#880000~1~0~none~gge949~0#@$A~M 231.6 -665.071 A 4 3.9 0 1 1 239.565 -665.066~~#880000~1~0~none~gge952~0#@$A~M 240.067 -665.071 A 4 3.9 0 1 1 248.032 -665.066~~#880000~1~0~none~gge955~0#@$A~M 248.7 -665.069 A 4 3.9 0 1 1 256.665 -665.064~~#880000~1~0~none~gge958~0",
		"D": "LIB~325~-345~package`DO-35_BD2.0-L4.2-P8.20-D0.5-RD`Supplier`LCSC`Supplier Part`C13769`Manufacturer`STMicroelectronics`Manufacturer Part`1N4148`Contributor`LCSC`spicePre`D`spiceSymbolName`1N4148`~~0~gge78eedfeeda6f0b7f~6c939f0b67d24ba88150ca5feca61f68~62a5d91115c34b5b8d27e6b924c6c14e~0~~yes~yes~~1572944017~#@$T~N~318.96~-354~0~#000080~Arial~~~~~comment~1N4148~1~start~gge5779~0~#@$T~P~318.96~-362.33~0~#000080~Arial~~~~~comment~D1~1~start~gge5785~0~#@$PT~M 330 -351 L 320 -345 L 330 -339 Z ~#880000~1~0~none~gge5791~0~#@$P~show~0~1~305~-345~180~gge5794~0^^305~-345^^M 305 -345 h 15~#880000^^0~323~-342~0~1~start~~~#0000FF^^0~314~-346~0~1~end~~~#0000FF^^0~317~-345^^0~M 320 -342 L 323 -345 L 320 -348#@$P~show~0~2~345~-345~0~gge5815~0^^345~-345^^M 345 -345 h -15~#880000^^0~327~-342~0~2~end~~~#0000FF^^0~336~-346~0~2~start~~~#0000FF^^0~333~-345^^0~M 330 -348 L 327 -345 L 330 -342#@$PL~320 -339 320 -351~#880000~1~0~none~gge5836~0",
		"LED": "LIB~215~-355~package`LED0603_RED`Manufacturer`EVERLIGHT(台湾亿光)`Manufacturer Part`19-217/R6C-AL1M2VY/3T`Supplier Part`C72044`Supplier`LCSC`link``Contributor`LCEDA_01`spicePre`L`spiceSymbolName`LED-0603_R`~~0~ggec25621e1a37b60b5~1efb3a885b5b4aecb6d41221a8f4d86b~5cbe824183374fac8e4c1ae848199ce3~0~~yes~yes~~1586866965~#@$T~N~203.26~-375~0~#000080~Arial~~~~~comment~LED-0603_R~1~start~gge5479~0~#@$T~P~203.26~-383.33~0~#000080~Arial~~~~~comment~LED2~1~start~gge5485~0~#@$PT~M 210 -349 L 220 -355 L 210 -362 Z ~#880000~1~0~#FF0000~gge5491~0~#@$PL~220 -363 220 -347~#880000~1~0~#FF0000~gge5494~0#@$PL~220 -365 224 -369~#880000~1~0~#880000~gge5497~0#@$PL~224 -361 228 -365~#880000~1~0~#880000~gge5500~0#@$PT~M 227 -372 L 223 -370 L 225 -368 Z ~#880000~1~0~#FF0000~gge5503~0~#@$PT~M 231 -368 L 227 -366 L 229 -364 Z ~#880000~1~0~#FF0000~gge5506~0~#@$P~show~0~1~195~-355~180~gge5509~0^^195~-355^^M 195 -355 h 15~#880000^^0~212~-352~0~1~start~~~#0000FF^^0~208~-356~0~1~end~~~#0000FF^^0~207~-355^^0~M 210 -352 L 213 -355 L 210 -358#@$P~show~0~2~235~-355~0~gge5530~0^^235~-355^^M 235 -355 h -15~#880000^^0~218~-352~0~2~end~~~#0000FF^^0~222~-356~0~2~start~~~#0000FF^^0~223~-355^^0~M 220 -358 L 217 -355 L 220 -352",
		"Q_NPN": "LIB~475~-395~package`SOT-23-3_L2.9-W1.3-P1.90-LS2.4-TR`Supplier`LCSC`Manufacturer`KEC`Manufacturer Part`2n3904S-RTK/PS`Supplier Part`C18536`Paste Type`SOT-23`Contributor`LCEDA_Lib`spicePre`Q`spiceSymbolName`2N3904(SOT-23)`~~0~gge2fd4581c81a04a5a~4a81c52f384a4e1ba3f57a3703e0f5f9~4e5e5775fd634dd48141eafc77c26e7a~0~~yes~yes~~1586867528~#@$T~N~489~-383.33~0~#000080~Arial~~~~~comment~2N3904(SOT-23)~1~start~gge6031~0~#@$T~P~489~-391.67~0~#000080~Arial~~~~~comment~Q1~1~start~gge6037~0~#@$P~show~1~2~465~-395~180~gge6043~0^^465~-395^^M 465 -395 h 10~#880000^^0~480~-392~0~B~start~~~#0000FF^^0~475~-396~0~2~end~~~#0000FF^^0~472~-395^^0~M 475 -392 L 478 -395 L 475 -398#@$P~show~1~3~485~-415~90~gge6064~0^^485~-415^^M 485 -415 v 10~#880000^^0~488~-400~270~C~end~~~#0000FF^^0~484~-405~270~3~start~~~#0000FF^^0~485~-408^^0~M 482 -405 L 485 -402 L 488 -405#@$P~show~1~1~485~-375~270~gge6085~0^^485~-375^^M 485 -375 v -10~#880000^^0~488~-390~270~E~start~~~#0000FF^^0~484~-385~270~1~end~~~#0000FF^^0~485~-382^^0~M 488 -385 L 485 -388 L 482 -385#@$PL~485 -405 475 -398~#880000~1~0~none~gge6106~0#@$PL~475 -392 485 -385~#880000~1~0~none~gge6109~0#@$PL~475 -404 475 -386~#880000~1~0~none~gge6112~0#@$PG~485 -385 482 -390 479 -386~#880000~1~0~#880000~gge6115~0",
		"Q_PNP": "LIB~480~-320~package`SOT-23-3_L2.9-W1.6-P1.90-LS2.8-TR-CW`Supplier`LCSC`Manufacturer`KEC`Manufacturer Part`2N3906S-RTK/PS`Contributor`LCEDA_Lib`Supplier Part`C147294`spicePre`Q`spiceSymbolName`2N3906(SOT-23)`~~0~gge5d96a02bbbaa08d1~d6e73ad364584752b04d0c41432bd4f7~bb9f85992cbb43858c321afed6f603e5~0~~yes~yes~~1586867557~#@$T~N~494~-308.33~0~#000080~Arial~~~~~comment~2N3906(SOT-23)~1~start~gge6211~0~#@$T~P~494~-316.67~0~#000080~Arial~~~~~comment~Q2~1~start~gge6217~0~#@$P~show~1~2~470~-320~180~gge6223~0^^470~-320^^M 470 -320 h 10~#880000^^0~485~-317~0~B~start~~~#0000FF^^0~480~-321~0~2~end~~~#0000FF^^0~477~-320^^0~M 480 -317 L 483 -320 L 480 -323#@$P~show~1~3~490~-340~90~gge6244~0^^490~-340^^M 490 -340 v 10~#880000^^0~493~-325~270~C~end~~~#0000FF^^0~489~-330~270~3~start~~~#0000FF^^0~490~-333^^0~M 487 -330 L 490 -327 L 493 -330#@$P~show~1~1~490~-300~270~gge6265~0^^490~-300^^M 490 -300 v -10~#880000^^0~493~-315~270~E~start~~~#0000FF^^0~489~-310~270~1~end~~~#0000FF^^0~490~-307^^0~M 493 -310 L 490 -313 L 487 -310#@$PL~490 -330 480 -323~#880000~1~0~none~gge6286~0#@$PL~480 -317 490 -310~#880000~1~0~none~gge6289~0#@$PL~480 -329 480 -311~#880000~1~0~none~gge6292~0#@$PG~480 -317 483 -312 486 -316~#880000~1~0~#880000~gge6295~0",
		"M_NMOS": "LIB~620~-440~package`SOT-23_L2.9-W1.3-P0.95-LS2.4-BR`Supplier`LCSC`Manufacturer`Nexperia`Manufacturer Part`2N7002,215`image`//image.lceda.cn/szlcsc/C65189.jpg`Supplier Part`C65189`Paste Type`expand`Contributor`LCEDA_Lib`spicePre`Q`spiceSymbolName`2N7002`~~0~ggeca7a334418db4e55~2a819e02584e46aea9f04b619de61270~978dd86cb8f545279789152357b8a3b4~0~~yes~yes~~1586867585~#@$T~N~646~-428.33~0~#000080~Arial~~~~~comment~2N7002~1~start~gge6391~0~#@$T~P~646~-436.67~0~#000080~Arial~~~~~comment~Q3~1~start~gge6397~0~#@$PG~620 -440 626 -438 626 -442~#880000~1~0~#FEFEFE~gge6403~0#@$PG~640 -442 637 -437 643 -437~#880000~1~0~#FEFEFE~gge6406~0#@$PL~620 -447 630 -447 630 -450 640 -450 640 -442~#880000~1~0~none~gge6409~0#@$PL~620 -440 630 -440 630 -430 640 -430 640 -437~#880000~1~0~none~gge6412~0#@$PL~630 -433 620 -433~#880000~1~0~none~gge6415~0#@$PL~618 -449 618 -431~#880000~1~0~none~gge6418~0#@$PL~620 -449 620 -445~#880000~1~0~none~gge6421~0#@$PL~620 -438 620 -442~#880000~1~0~none~gge6424~0#@$PL~620 -431 620 -435~#880000~1~0~none~gge6427~0#@$PL~610 -440 618 -440~#880000~1~0~none~gge6430~0#@$PL~644 -442 642 -442 638 -442 636 -442~#880000~1~0~none~gge6433~0#@$P~show~0~3~630~-460~90~gge6436~0^^630~-460^^M 630 -460 v 10~#880000^^0~633~-447~270~D~end~~~#000000^^0~629~-451~270~3~start~~~#000000^^0~630~-453^^0~M 627 -450 L 630 -447 L 633 -450#@$P~show~0~1~605~-440~180~gge6457~0^^605~-440^^M 605 -440 h 10~#880000^^0~618~-437~0~G~start~~~#000000^^0~614~-441~0~1~end~~~#000000^^0~612~-440^^0~M 615 -437 L 618 -440 L 615 -443#@$P~show~0~2~630~-420~270~gge6478~0^^630~-420^^M 630 -420 v -10~#880000^^0~633~-433~270~S~start~~~#000000^^0~629~-429~270~2~end~~~#000000^^0~630~-427^^0~M 633 -430 L 630 -433 L 627 -430",
		"M_PMOS": "LIB~635~-360~package`TO-263-2_L10.0-W9.1-P5.08-LS15.2-BR`Supplier`LCSC`Manufacturer`IR`Manufacturer Part`IRF5210STRLPBF`image`//image.lceda.cn/szlcsc/C2622.jpg`Supplier Part`C2622`Paste Type`expand`Contributor`LCEDA_Lib`spicePre`Q`spiceSymbolName`IRF5210`~~0~ggedd0a00139b0b25bf~18619f02a62e4d1d91aef7176ecdc089~0c33b4cb20b6470fa5657b054ce476d4~0~~yes~yes~~1586867599~#@$T~N~661~-348.33~0~#000080~Arial~~~~~comment~IRF5210~1~start~gge6613~0~#@$T~P~661~-356.67~0~#000080~Arial~~~~~comment~Q4~1~start~gge6619~0~#@$PL~635 -367 645 -367 645 -370 655 -370 655 -362~#880000~1~0~none~gge6625~0#@$PL~635 -360 645 -360 645 -350 655 -350 655 -357~#880000~1~0~none~gge6628~0#@$PL~645 -353 635 -353~#880000~1~0~none~gge6631~0#@$PL~633 -369 633 -351~#880000~1~0~none~gge6634~0#@$PL~635 -369 635 -365~#880000~1~0~none~gge6637~0#@$PL~635 -358 635 -362~#880000~1~0~none~gge6640~0#@$PL~635 -351 635 -355~#880000~1~0~none~gge6643~0#@$PL~630 -360 633 -360~#880000~1~0~none~gge6646~0#@$P~show~0~4~645~-380~90~gge6649~0^^645~-380^^M 645 -380 v 10~#880000^^0~648~-367~270~D~end~~~#000000^^0~644~-371~270~4~start~~~#000000^^0~645~-373^^0~M 642 -370 L 645 -367 L 648 -370#@$P~show~0~1~620~-360~180~gge6670~0^^620~-360^^M 620 -360 h 10~#880000^^0~633~-357~0~G~start~~~#000000^^0~629~-361~0~1~end~~~#000000^^0~627~-360^^0~M 630 -357 L 633 -360 L 630 -363#@$P~show~0~3~645~-340~270~gge6691~0^^645~-340^^M 645 -340 v -10~#880000^^0~648~-353~270~S~start~~~#000000^^0~644~-349~270~3~end~~~#000000^^0~645~-347^^0~M 648 -350 L 645 -353 L 642 -350#@$PG~643 -360 637 -362 637 -358~#880000~1~0~none~gge6712~0#@$PG~655 -357.5 658 -362.5 652 -362.5~#880000~1~0~#FEFEFE~gge6715~0#@$PL~651 -357.5 653 -357.5 657 -357.5 659 -357.5~#880000~1~0~none~gge6718~0",
		"SW": "LIB~115~-660~package`KEY-SMD_2P-L6.2-W3.6-LS8.0`Supplier Part`C118141`Supplier`LCSC`Manufacturer Part`K2-1107ST-A4SW-06`Contributor`LCEDA_Lib`制造商`韩国韩荣`spicePre`K`spiceSymbolName`K2-3.6×6.1_SMD`~~0~ggeee35b4de35babf26~daacbe2eec304950b61eef2efe596556~5c1036b53a4146e4841df4ed0a9de8f0~0~~yes~yes~~1586866326~#@$T~N~103.0703125~-673~0~#000080~Arial~~~~~comment~K2-3.6×6.1_SMD~1~start~gge4330~0~#@$T~P~103.0703125~-682~0~#000080~Arial~~~~~comment~KEY1~1~start~gge4336~0~#@$E~125~-660~2~2~#880000~1~0~none~gge4342~0#@$E~105~-660~2~2~#880000~1~0~none~gge4345~0#@$P~show~0~1~90~-660~180~gge4348~0^^90~-660^^M 90 -660 h 13~#880000^^0~105~-657~0~1~start~~~#000000^^1~101~-661~0~1~end~~~#000000^^0~100~-660^^0~M 103 -657 L 106 -660 L 103 -663#@$P~show~0~2~140~-660~0~gge4369~0^^140~-660^^M 140 -660 h -13~#880000^^0~125~-657~0~2~end~~~#000000^^1~130~-661~0~2~start~~~#000000^^0~130~-660^^0~M 127 -663 L 124 -660 L 127 -657#@$PL~105 -665 125 -665 125 -666 118 -666 118 -668 112 -668 112 -666 105 -666 105 -665~#880000~1~0~none~gge4390~0",
		"CONN2": "LIB~420~-720~package`HDR-M-2.54_1X2`Supplier Part`C124375`Supplier`LCSC`Manufacturer``Manufacturer Part``Contributor`LCEDA_Lib`spicePre`J`spiceSymbolName`HDR-M-2.54_1x2`~~0~gge51605a4de98042ca~70aa5812f21f4991bf427395d51849f4~a9aa2b14f188405792fa87ac344499a4~0~~yes~yes~~1586865108~#@$T~N~414.0703125~-738~0~#000080~Arial~~~~~comment~HDR-M-2.54_1x2~1~start~gge1603~0~#@$T~P~414.0703125~-747~0~#000080~Arial~~~~~comment~J2~1~start~gge1609~0~#@$R~415~-735~2~2~20~30~#880000~1~0~none~gge1615~0~#@$P~show~0~1~405~-725~180~gge1618~0^^405~-725^^M 405 -725 h 10~#000000^^1~417~-722~0~1~start~~~#000000^^0~415~-726~0~1~end~~~#000000^^0~412~-725^^0~M 415 -722 L 418 -725 L 415 -728#@$P~show~0~2~405~-715~180~gge1639~0^^405~-715^^M 405 -715 h 10~#000000^^1~417~-712~0~2~start~~~#000000^^0~415~-716~0~2~end~~~#000000^^0~412~-715^^0~M 415 -712 L 418 -715 L 415 -718",
		"CONN3": "LIB~420~-645~package`HDR-M-2.54_1X3`Supplier Part`C180248`Supplier`LCSC`Manufacturer``Manufacturer Part``image``Contributor`LCEDA_Lib`spicePre`J`spiceSymbolName`HDR-M-2.54_1x3`~~0~ggea7b8eba697cc4bf7~9f77654394344f25b3de138e0fe05ff6~a68dc5e6a9944c46b7604648a43dcd65~0~~yes~yes~~1586865128~#@$T~N~414.0703125~-668~0~#000080~Arial~~~~~comment~HDR-M-2.54_1x3~1~start~gge1723~0~#@$T~P~414.0703125~-677~0~#000080~Arial~~~~~comment~J3~1~start~gge1729~0~#@$R~415~-665~2~2~20~40~#880000~1~0~none~gge1735~0~#@$P~show~1~3~405~-635~180~gge1738~0^^405~-635^^M 405 -635 h 10~#000000^^1~420~-632~0~3~start~~~#000000^^0~415~-636~0~3~end~~~#000000^^0~412~-635^^0~M 415 -632 L 418 -635 L 415 -638#@$P~show~1~1~405~-655~180~gge1759~0^^405~-655^^M 405 -655 h 10~#000000^^1~420~-652~0~1~start~~~#000000^^0~415~-656~0~1~end~~~#000000^^0~412~-655^^0~M 415 -652 L 418 -655 L 415 -658#@$P~show~1~2~405~-645~180~gge1780~0^^405~-645^^M 405 -645 h 10~#000000^^1~420~-642~0~2~start~~~#000000^^0~415~-646~0~2~end~~~#000000^^0~412~-645^^0~M 415 -642 L 418 -645 L 415 -648",
		"CONN4": "LIB~425~-555~package`HDR-M-2.54_1X4`Supplier Part`C124378`Supplier`LCSC`Manufacturer``Manufacturer Part``Contributor`LCEDA_Lib`spicePre`J`spiceSymbolName`HDR-M-2.54_1x4`~~0~gge770114993b8ec29b~282f7786cb6144d097ae00194c3e3fb3~f5b1d9403e49471cab43bc5a1bec336f~0~~yes~yes~~1586865142~#@$T~N~414.0703125~-583~0~#000080~Arial~~~~~comment~HDR-M-2.54_1x4~1~start~gge1885~0~#@$T~P~414.0703125~-592~0~#000080~Arial~~~~~comment~J4~1~start~gge1891~0~#@$R~415~-580~2~2~20~50~#880000~1~0~none~gge1897~0~#@$P~show~0~1~405~-570~180~gge1900~0^^405~-570^^M 405 -570 h 10~#000000^^1~418.7~-568~0~1~start~~~#000000^^0~414.5~-571~0~1~end~~~#000000^^0~412~-570^^0~M 415 -567 L 418 -570 L 415 -573#@$P~show~0~2~405~-560~180~gge1921~0^^405~-560^^M 405 -560 h 10~#000000^^1~418.7~-556~0~2~start~~~#000000^^0~414.5~-561~0~2~end~~~#000000^^0~412~-560^^0~M 415 -557 L 418 -560 L 415 -563#@$P~show~0~3~405~-550~180~gge1942~0^^405~-550^^M 405 -550 h 10~#000000^^1~418.7~-546~0~3~start~~~#000000^^0~414.5~-551~0~3~end~~~#000000^^0~412~-550^^0~M 415 -547 L 418 -550 L 415 -553#@$P~show~0~4~405~-540~180~gge1963~0^^405~-540^^M 405 -540 h 10~#000000^^1~418.7~-536~0~4~start~~~#000000^^0~414.5~-541~0~4~end~~~#000000^^0~412~-540^^0~M 415 -537 L 418 -540 L 415 -543",
		"HDR2X2": "LIB~535~-775~package`HDR-M-2.54_2X2`Supplier Part`C66690`Supplier`LCSC`Manufacturer``Manufacturer Part``Contributor`LCEDA_Lib`spicePre`J`spiceSymbolName`HDR-M-2.54_2x2`~~0~gge19be83ec764d96ec~8c011694efe04de7ac0c392bf11240d5~0d0a13f4d5e4481aa82dc0293d1aa27e~0~~yes~yes~~1586865518~#@$T~N~530.0703125~-793~0~#000080~Arial~~~~~comment~HDR-M-2.54_2x2~1~start~gge2188~0~#@$T~P~530.0703125~-802~0~#000080~Arial~~~~~comment~J5~1~start~gge2194~0~#@$R~515~-790~2~2~40~30~#880000~1~0~none~gge2200~0~#@$P~show~1~1~505~-780~180~gge2203~0^^505~-780^^M 505 -780 h 10~#000000^^1~520~-777~0~1~start~~~#000000^^0~515~-781~0~1~end~~~#000000^^0~512~-780^^0~M 515 -777 L 518 -780 L 515 -783#@$P~show~1~2~565~-780~0~gge2224~0^^565~-780^^M 565 -780 h -10~#000000^^1~550~-777~0~2~end~~~#000000^^0~555~-781~0~2~start~~~#000000^^0~558~-780^^0~M 555 -783 L 552 -780 L 555 -777#@$P~show~1~3~505~-770~180~gge2245~0^^505~-770^^M 505 -770 h 10~#000000^^1~520~-767~0~3~start~~~#000000^^0~515~-771~0~3~end~~~#000000^^0~512~-770^^0~M 515 -767 L 518 -770 L 515 -773#@$P~show~1~4~565~-770~0~gge2266~0^^565~-770^^M 565 -770 h -10~#000000^^1~550~-767~0~4~end~~~#000000^^0~555~-771~0~4~start~~~#000000^^0~558~-770^^0~M 555 -773 L 552 -770 L 555 -767",
		"HDR2X3": "LIB~535~-695~package`HDR-M-2.54_2X3`Supplier Part`C65114`Supplier`LCSC`Manufacturer``Manufacturer Part``Contributor`LCEDA_Lib`spicePre`J`spiceSymbolName`HDR-M-2.54_2x3`~~0~gge1df0907c9c93ea3e~a5b8fff1a45c42f9aa306bafedcb5748~8c95eef853b1473e9539399823e4b359~0~~yes~yes~~1586865532~#@$T~N~530.0703125~-723~0~#000080~Arial~~~~~comment~HDR-M-2.54_2x3~1~start~gge2392~0~#@$T~P~530.0703125~-732~0~#000080~Arial~~~~~comment~J6~1~start~gge2398~0~#@$R~515~-720~2~2~40~40~#880000~1~0~none~gge2404~0~#@$P~show~1~1~505~-710~180~gge2407~0^^505~-710^^M 505 -710 h 10~#000000^^1~520~-707~0~1~start~~~#000000^^0~515~-711~0~1~end~~~#000000^^0~512~-710^^0~M 515 -707 L 518 -710 L 515 -713#@$P~show~1~2~565~-710~0~gge2428~0^^565~-710^^M 565 -710 h -10~#000000^^1~550~-707~0~2~end~~~#000000^^0~555~-711~0~2~start~~~#000000^^0~558~-710^^0~M 555 -713 L 552 -710 L 555 -707#@$P~show~1~3~505~-700~180~gge2449~0^^505~-700^^M 505 -700 h 10~#000000^^1~520~-697~0~3~start~~~#000000^^0~515~-701~0~3~end~~~#000000^^0~512~-700^^0~M 515 -697 L 518 -700 L 515 -703#@$P~show~1~4~565~-700~0~gge2470~0^^565~-700^^M 565 -700 h -10~#000000^^1~550~-697~0~4~end~~~#000000^^0~555~-701~0~4~start~~~#000000^^0~558~-700^^0~M 555 -703 L 552 -700 L 555 -697#@$P~show~1~5~505~-690~180~gge2491~0^^505~-690^^M 505 -690 h 10~#000000^^1~520~-687~0~5~start~~~#000000^^0~515~-691~0~5~end~~~#000000^^0~512~-690^^0~M 515 -687 L 518 -690 L 515 -693#@$P~show~1~6~565~-690~0~gge2512~0^^565~-690^^M 565 -690 h -10~#000000^^1~550~-687~0~6~end~~~#000000^^0~555~-691~0~6~start~~~#000000^^0~558~-690^^0~M 555 -693 L 552 -690 L 555 -687",
		"XTAL": "LIB~670~-510~package`CRYSTAL-SMD_L3.2-W1.5-1`Contributor`LCSC`Supplier`LCSC`Supplier Part`C9900007653`Manufacturer Part`xtal-32.768KHz`Manufacturer`null`JLCPCB Part Class`Extended Part`spicePre`X`spiceSymbolName`XTAL-32.768KHZ`~~0~gge21c393d83d1b78b4~cb6dc8e63f7141709db677dfda6b4bfd~5b5daec01f4141819135476a52015585~0~~yes~yes~281d0445c9944665936fc186aab2fc53~1747074243~6d2617e31b664836aa9078ac6765ff0d#@$T~N~663.55~-520~0~#000080~Arial~~~~~comment~XTAL-32.768KHZ~1~start~gge8317~0~#@$T~P~664.89~-528.33~0~#000080~Arial~~~~~comment~X1~1~start~gge8323~0~#@$PL~674 -510 680 -510~#8D2323~1~0~none~gge8329~0#@$PL~660 -510 666 -510~#8D2323~1~0~none~gge8332~0#@$PL~674 -517 674 -503~#8D2323~1~0~none~gge8335~0#@$P~show~0~2~690~-510~0~gge8338~0^^690~-510^^M 690 -510 h -10~#8D2323^^0~677~-507~0~2~end~~~#8D2323^^0~681~-511~0~2~start~~~#8D2323^^0~683~-510^^0~M 680 -513 L 677 -510 L 680 -507#@$P~show~0~1~650~-510~180~gge8359~0^^650~-510^^M 650 -510 h 10~#8D2323^^0~663~-507~0~1~start~~~#8D2323^^0~659~-511~0~1~end~~~#8D2323^^0~657~-510^^0~M 660 -507 L 663 -510 L 660 -513#@$R~668~-517~~~4~14~#880000~1~0~none~gge8380~0~#@$PL~666 -517 666 -503~#8D2323~1~0~none~gge8383~0",
		"XTAL4": "LIB~655~-590~package`CRYSTAL-SMD_4P-L2.5-W2.0-BL_XTAL12MHZ`Contributor`LCSC`Supplier`LCSC`Supplier Part`C9900004382`Manufacturer`null`Manufacturer Part`XTAL12MHz`JLCPCB Part Class`Extended Part`spicePre`U`spiceSymbolName`XTAL12MHZ`~~0~gge72325411b43a8559~5c75ddaf38a34995912a922fecf0dd45~c2aa7ab7417640f69ff77e17dd4e8db0~0~~yes~yes~d0408b78e17a47d1b1d20c7d911db759~1744300108~e98691e00ec34af4ae3ddd4527f5f9e1#@$T~N~649.03~-613~0~#000080~Arial~~~~~comment~XTAL12MHZ~1~start~gge9040~0~#@$T~P~649.03~-622.14~0~#000080~Arial~~~~~comment~X5~1~start~gge9046~0~#@$R~635~-610~2~2~40~40~#880000~1~0~none~gge9052~0~#@$P~show~1~4~625~-600~180~gge9055~0^^625~-600^^M 625 -600 h 10~#000000^^0~636~-596~0~GND~start~~~#000000^^0~630~-601~0~4~end~~~#000000^^0~632~-600^^0~M 635 -597 L 638 -600 L 635 -603#@$P~show~1~2~685~-580~0~gge9076~0^^685~-580^^M 685 -580 h -10~#000000^^0~674~-575~0~GND~end~~~#000000^^0~680~-581~0~2~start~~~#000000^^0~678~-580^^0~M 675 -583 L 672 -580 L 675 -577#@$PL~658 -597 658 -583 652 -583 652 -597 658 -597~#880011~1~0~none~gge9097~0#@$PL~650 -583 650 -597~#880011~1~0~none~gge9100~0#@$PL~660 -583 660 -597~#880011~1~0~none~gge9103~0#@$PL~635 -580 645 -580 645 -590 649 -590~#880011~1~0~none~gge9106~0#@$PL~675 -600 665 -600 665 -590 660 -590~#880011~1~0~none~gge9109~0#@$PL~652 -583 652 -597 658 -597 658 -583~#880011~1~0~none~gge9112~0#@$PL~660 -586 660 -594~#880011~1~0~none~gge9115~0#@$PL~658 -583 652 -583~#880011~1~0~none~gge9118~0#@$PL~650 -586 650 -594~#880011~1~0~none~gge9121~0#@$P~show~1~3~685~-600~0~gge9124~0^^685~-600^^M 685 -600 h -10~#000000^^0~670~-597~0~OSC2~end~~~#000000^^0~680~-601~0~3~start~~~#000000^^0~678~-600^^0~M 675 -603 L 672 -600 L 675 -597#@$P~show~1~1~625~-580~180~gge9145~0^^625~-580^^M 625 -580 h 10~#000000^^0~640~-577~0~OSC1~start~~~#000000^^0~630~-581~0~1~end~~~#000000^^0~632~-580^^0~M 635 -577 L 638 -580 L 635 -583"
	};

	P.META = {
	"R": {
		"label": "电阻 0805",
		"pre": "R"
	},
	"C": {
		"label": "无极性电容 0805",
		"pre": "C"
	},
	"C_TAN": {
		"label": "钽电容 / 有极性电容",
		"pre": "C"
	},
	"L": {
		"label": "电感 0603",
		"pre": "L"
	},
	"D": {
		"label": "二极管（1N4148）",
		"pre": "D"
	},
	"LED": {
		"label": "发光二极管 0603",
		"pre": "D"
	},
	"Q_NPN": {
		"label": "NPN 三极管（2N3904，SOT-23）",
		"pre": "Q"
	},
	"Q_PNP": {
		"label": "PNP 三极管（2N3906，SOT-23）",
		"pre": "Q"
	},
	"M_NMOS": {
		"label": "N 沟道 MOSFET（2N7002，SOT-23）",
		"pre": "Q"
	},
	"M_PMOS": {
		"label": "P 沟道 MOSFET（IRF5210，TO-263）",
		"pre": "Q"
	},
	"SW": {
		"label": "轻触按键（K2-1107，2 脚）",
		"pre": "K"
	},
	"CONN2": {
		"label": "排针 1x2（2.54mm）",
		"pre": "J"
	},
	"CONN3": {
		"label": "排针 1x3（2.54mm）",
		"pre": "J"
	},
	"CONN4": {
		"label": "排针 1x4（2.54mm）",
		"pre": "J"
	},
	"HDR2X2": {
		"label": "排针 2x2（2.54mm）",
		"pre": "J"
	},
	"HDR2X3": {
		"label": "排针 2x3（2.54mm）",
		"pre": "J"
	},
	"XTAL": {
		"label": "晶振 32.768kHz（两脚贴片）",
		"pre": "X"
	},
	"XTAL4": {
		"label": "晶振 12MHz（4 脚贴片）",
		"pre": "U"
	}
};

	/* ------------------------------------------------------------ helpers -- */

	function clone(o) { return JSON.parse(JSON.stringify(o)); }
	function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
	function rid(seq) {
		return 'gge' + Date.now().toString(36) + seq.toString(36) +
			Math.floor(Math.random() * 1296).toString(36);
	}
	function shift(v, d) {
		var n = parseFloat(v);
		if (!isFinite(n)) return v;
		return String(Math.round((n + d) * 10000) / 10000);
	}
	/** shifts every number in a "x y x y …" / path string (dx applied to evens) */
	function shiftSeq(s, dx, dy) {
		if (!s) return s;
		var re = /-?\d+(?:\.\d+)?/g, m, last = 0, res = '', i = 0;
		while ((m = re.exec(s))) {
			res += s.slice(last, m.index);
			res += shift(m[0], i % 2 === 0 ? dx : dy);
			i++;
			last = m.index + m[0].length;
		}
		return res + s.slice(last);
	}
	function simplePinPath(s) {
		var m = /^\s*M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*([hv])\s*(-?[\d.]+)\s*$/i.exec(s || '');
		return m ? { dir: m[3].toLowerCase(), len: m[4] } : null;
	}
	/**
	 * Shifts an SVG path by (dx, dy) without touching lengths/arc flags.
	 * Only real coordinates move: M/L pairs, H (x), V (y), C/S/Q/T pairs,
	 * A's final pair.  This keeps pin lengths and directions intact.
	 */
	function svgShift(path, dx, dy) {
		if (!path) return path;
		var tokens = String(path).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
		var out = [], i = 0;
		function n() { return parseFloat(tokens[i++]); }
		function fmt(v) { return String(Math.round(v * 10000) / 10000); }
		while (i < tokens.length) {
			var cmd = tokens[i++];
			if (!/^[a-zA-Z]$/.test(cmd)) { i--; cmd = 'L'; }   /* implicit repeat */
			out.push(cmd);
			var up = cmd.toUpperCase(), rel = cmd !== up;
			var count = 0;
			if (up === 'M' || up === 'L') count = 2;
			else if (up === 'H' || up === 'V') count = 1;
			else if (up === 'C') count = 6;
			else if (up === 'S' || up === 'Q') count = 4;
			else if (up === 'T') count = 2;
			else if (up === 'A') count = 7;
			else continue;                                     /* Z */

			/* some commands repeat their argument groups */
			while (i + count <= tokens.length - 1 || (i + count === tokens.length)) {
				var args = [];
				for (var k = 0; k < count; k++) args.push(n());
				if (up === 'M' || up === 'L' || up === 'C' || up === 'S' ||
					up === 'Q' || up === 'T') {
					for (var p = 0; p + 1 < args.length; p += 2) {
						if (!rel) { args[p] += dx; args[p + 1] += dy; }
					}
				} else if (up === 'H') {
					if (!rel) args[0] += dx;
				} else if (up === 'V') {
					if (!rel) args[0] += dy;
				} else if (up === 'A') {
					if (!rel) { args[5] += dx; args[6] += dy; }
				}
				out.push(args.map(fmt).join(' '));
				/* another group of the same command? only L/C/S/Q/T can repeat */
				if (!(up === 'L' || up === 'C' || up === 'S' || up === 'Q' || up === 'T')) break;
				if (i >= tokens.length || /^[a-zA-Z]$/.test(tokens[i])) break;
			}
		}
		return out.join(' ');
	}

	function setPara(cpara, key, value) {
		var segs = cpara ? String(cpara).split('`') : [];
		var hit = false, i;
		for (i = 0; i + 1 < segs.length; i += 2) {
			if (segs[i] === key) { segs[i + 1] = String(value); hit = true; }
		}
		if (!hit) { segs.push(key); segs.push(String(value)); }
		return segs.join('`');
	}
	function setParaLike(cpara, prefix, value) {
		var segs = cpara ? String(cpara).split('`') : [];
		var hit = false, i;
		for (i = 0; i + 1 < segs.length; i += 2) {
			if (segs[i].indexOf(prefix) === 0) { segs[i + 1] = String(value); hit = true; }
		}
		return hit ? segs.join('`') : cpara;
	}
	function pairs(s) {
		var nums = String(s || '').split(/[\s,]+/), out = [], i;
		for (i = 0; i + 1 < nums.length; i += 2) {
			out.push({ x: nums[i], y: nums[i + 1] });
		}
		return out;
	}

	/* --------------------------------------------------------------- parse -- */

	/**
	 * Decodes one raw EasyEDA LIB string into the jsonCache block
	 * createShape() expects.  Coordinates are normalised to the symbol origin.
	 */
	P.parse = function (raw) {
		if (!raw) return null;
		var parts = String(raw).split('#@$');
		var hf = parts[0].split('~');
		var ox = num(hf[1]), oy = num(hf[2]);

		var block = {
			head: {
				gId: 'lib', x: 0, y: 0,
				c_para: hf[3] || '', rotation: hf[4] || '0',
				importFlag: hf[5] || '0', puuid: '', uuid: '', locked: '0',
				bind_pcb_id: '', convert_to_pcb: 'yes', add_into_bom: 'yes',
				datastrid: '', pdatastrid: '', utime: ''
			},
			itemOrder: [],
			rect: {}, polyline: {}, polygon: {}, path: {}, arc: {},
			ellipse: {}, circle: {}, pin: {}, annotation: {}
		};

		function add(kind, gid, obj) {
			block[kind][gid] = obj;
			block.itemOrder.push(gid);
		}

		parts.slice(1).forEach(function (child) {
			if (!child) return;
			var f, gid;

			if (child.indexOf('^^') >= 0 || child.indexOf('P~') === 0) {
				var segs = child.split('^^');
				var cfg = segs[0].split('~');
				gid = cfg[7] || 'p';
				var pin = {
					gId: gid, locked: '0',
					configure: {
						x: shift(cfg[4], -ox), y: shift(cfg[5], -oy),
						rotation: cfg[6] || '0',
						electric: cfg[2] || '0', spicePin: cfg[3] || '',
						display: cfg[1] || 'show', shapeType: 'group', gId: gid, locked: '0'
					},
					pinDot: { x: 0, y: 0 },
					path: { pathString: '', pinColor: '#880000' },
					name: {}, num: {},
					dot: { visible: 0, x: 0, y: 0 },
					clock: { visible: 0, pathString: '' }
				};
				if (segs[1]) {
					var xy = segs[1].split('~');
					pin.pinDot = { x: shift(xy[0], -ox), y: shift(xy[1], -oy) };
				}
				if (segs[2]) {
					var pf = segs[2].split('~');
					pin.path = {
						pathString: svgShift(pf[0], -ox, -oy),
						pinColor: pf[1] || '#880000'
					};
				}
				function textSeg(seg) {
					var t = seg.split('~');
					return {
						visible: t[0], x: shift(t[1], -ox), y: shift(t[2], -oy),
						rotation: t[3] || '0', text: t[4] || '',
						textAnchor: t[5] || 'start', fontFamily: t[6] || '',
						fontSize: t[7] || '', fillColor: t[8] || '#0000FF'
					};
				}
				if (segs[3]) pin.name = textSeg(segs[3]);
				if (segs[4]) pin.num = textSeg(segs[4]);
				if (segs[5]) {
					var df = segs[5].split('~');
					pin.dot = {
						visible: df[0] || 0,
						x: shift(df[1], -ox), y: shift(df[2], -oy)
					};
				}
				if (segs[6]) {
					var cf = segs[6].split('~');
					pin.clock = {
						visible: cf[0] || 0,
						pathString: svgShift(cf[1], -ox, -oy)
					};
				}
				add('pin', gid, pin);
				return;
			}

			f = child.split('~');
			gid = '';
			switch (f[0]) {
				case 'T':
					gid = f[15] || 'a';
					add('annotation', gid, {
						gId: gid, mark: f[1], x: shift(f[2], -ox), y: shift(f[3], -oy),
						rotation: f[4] || '0', fillColor: f[5] || '',
						fontFamily: f[6] || '', fontSize: f[7] || '',
						fontWeight: f[8] || '', fontStyle: f[9] || '',
						dominantBaseline: f[10] || '', type: f[11] || 'comment',
						string: f[12] || '', visible: f[13], textAnchor: f[14] || 'start',
						locked: f[16] || '0', c_etype: f[17] || ''
					});
					break;
				case 'PL':
				case 'PG':
					gid = f[6];
					add(f[0] === 'PL' ? 'polyline' : 'polygon', gid, {
						gId: gid, pointArr: pairs(shiftSeq(f[1], -ox, -oy)),
						strokeColor: f[2], strokeWidth: f[3], strokeStyle: f[4],
						fillColor: f[5], locked: f[7] || '0'
					});
					break;
				case 'R':
					gid = f[11];
					add('rect', gid, {
						gId: gid, x: shift(f[1], -ox), y: shift(f[2], -oy),
						rx: f[3], ry: f[4], width: f[5], height: f[6],
						strokeColor: f[7], strokeWidth: f[8], strokeStyle: f[9],
						fillColor: f[10], locked: f[12] || '0',
						c_etype: f[13] || ''
					});
					break;
				case 'E':
					gid = f[9];
					add('ellipse', gid, {
						gId: gid, cx: shift(f[1], -ox), cy: shift(f[2], -oy),
						rx: f[3], ry: f[4], strokeColor: f[5], strokeWidth: f[6],
						strokeStyle: f[7], fillColor: f[8], locked: f[10] || '0'
					});
					break;
				case 'C':
					gid = f[8];
					add('circle', gid, {
						gId: gid, cx: shift(f[1], -ox), cy: shift(f[2], -oy), r: f[3],
						strokeColor: f[4], strokeWidth: f[5], strokeStyle: f[6],
						fillColor: f[7], locked: f[9] || '0'
					});
					break;
				case 'PT':
					gid = f[6];
					add('path', gid, {
						gId: gid, pathString: svgShift(f[1], -ox, -oy),
						strokeColor: f[2], strokeWidth: f[3], strokeStyle: f[4],
						fillColor: f[5], locked: f[7] || '0'
					});
					break;
				case 'A':
					gid = f[7];
					add('arc', gid, {
						gId: gid, pathString: svgShift(f[1], -ox, -oy),
						helperDots: svgShift(f[2], -ox, -oy),
						strokeColor: f[3], strokeWidth: f[4], strokeStyle: f[5],
						fillColor: f[6], locked: f[8] || '0'
					});
					break;
				default:
					break;   /* images / arrowheads are skipped */
			}
		});

		return block;
	};

	/* -------------------------------------------------------------- lookup -- */

	P.get = function (name) {
		var key = String(name == null ? '' : name).trim().toUpperCase();
		if (!P.RAW[key]) return null;
		var meta = P.META[key] || {};
		return { key: key, raw: P.RAW[key], label: meta.label || key, pre: meta.pre || 'U' };
	};

	P.names = function () { return Object.keys(P.RAW); };

	P.catalog = function () {
		return P.names().map(function (k) {
			var m = P.META[k] || {};
			return { key: k, label: m.label || '', pre: m.pre || 'U' };
		});
	};

	/* --------------------------------------------------------------- build -- */

	/**
	 * Instantiates a raw template at (x, y).
	 *
	 * @param {Object} tpl   from P.get()
	 * @param {Object} opts  {x, y, rotation, designator, name, value, package, pre}
	 * @returns {Object} jsonCache for api('createShape')
	 */
	P.build = function (tpl, opts) {
		opts = opts || {};
		if (!tpl || !tpl.raw) return null;
		var block = P.parse(tpl.raw);
		if (!block) return null;

		var seq = 0, idMap = {};
		function nid(old) {
			if (!idMap[old]) idMap[old] = rid(seq++);
			return idMap[old];
		}

		var X = num(opts.x), Y = num(opts.y), ROT = num(opts.rotation);
		var pre = String(opts.pre || tpl.pre || 'U').replace(/\?+$/, '') || 'U';

		function offPoint(p) { p.x = num(p.x) + X; p.y = num(p.y) + Y; }

		['rect', 'polyline', 'polygon', 'path', 'arc', 'ellipse', 'circle'].forEach(function (kind) {
			var map = block[kind];
			if (!map) return;
			var out = {};
			Object.keys(map).forEach(function (oldId) {
				var o = map[oldId];
				var id = nid(oldId);
				o.gId = id;
				if (o.pointArr) o.pointArr.forEach(offPoint);
				if (o.cx !== undefined) { o.cx = num(o.cx) + X; o.cy = num(o.cy) + Y; }
				if (o.x !== undefined && !o.pointArr) { o.x = num(o.x) + X; o.y = num(o.y) + Y; }
				if (o.pathString) o.pathString = svgShift(o.pathString, X, Y);
				if (o.helperDots) o.helperDots = svgShift(o.helperDots, X, Y);
				out[id] = o;
			});
			block[kind] = out;
		});

		/* annotations: P = designator (the editor numbers it), N = value / name */
		var annOut = {};
		Object.keys(block.annotation || {}).forEach(function (oldId) {
			var a = block.annotation[oldId];
			var id = nid(oldId);
			a.gId = id;
			offPoint(a);
			if (a.mark === 'P') {
				a.string = opts.designator || (pre + '?');
				a.visible = 1;
			} else if (a.mark === 'N') {
				if (opts.name) a.string = String(opts.name);
				if (opts.value) a.string = String(opts.value);
				a.visible = 1;
			}
			annOut[id] = a;
		});
		block.annotation = annOut;

		/* pins */
		var pinOut = {};
		Object.keys(block.pin || {}).forEach(function (oldId) {
			var p = block.pin[oldId];
			var id = nid(oldId);
			p.gId = id;
			if (p.configure) {
				p.configure.gId = id;
				p.configure.x = num(p.configure.x) + X;
				p.configure.y = num(p.configure.y) + Y;
			}
			['name', 'num'].forEach(function (k) {
				if (!p[k]) return;
				p[k].x = num(p[k].x) + X;
				p[k].y = num(p[k].y) + Y;
				p[k].visible = Number(p[k].visible) === 0 ? 0 : 1;
			});
			if (p.pinDot) { p.pinDot.x = num(p.pinDot.x) + X; p.pinDot.y = num(p.pinDot.y) + Y; }
			if (p.dot) { p.dot.x = num(p.dot.x) + X; p.dot.y = num(p.dot.y) + Y; }
			if (p.path && p.path.pathString) {
				p.path.pathString = svgShift(p.path.pathString, X, Y);
			}
			if (p.clock && p.clock.pathString) {
				p.clock.pathString = svgShift(p.clock.pathString, X, Y);
			}
			pinOut[id] = p;
		});
		block.pin = pinOut;

		var h = block.head;
		h.gId = nid(h.gId || 'lib');
		h.x = X;
		h.y = Y;
		h.rotation = ROT ? ROT : 0;
		/* designator prefix: the editor numbers each pre independently */
		h.c_para = setPara(h.c_para, 'pre', pre);
		if (opts.package) h.c_para = setPara(h.c_para, 'package', opts.package);
		if (opts.value) {
			h.c_para = setPara(h.c_para, 'value', opts.value);
			h.c_para = setParaLike(h.c_para, 'value(', opts.value);
		}

		block.itemOrder = (block.itemOrder || []).map(function (id) {
			return idMap[id] || id;
		});
		return block;
	};
})();
