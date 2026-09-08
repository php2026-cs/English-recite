// Original teaching examples, deliberately keyed by word + POS + exact sense.
// They are learning aids, not quotations from a dictionary or exam corpus.
export interface StudyExample {
  english: string;
  chinese: string;
}

export const studyExamples: Record<string, Record<string, StudyExample>> = {
  charge: {
    'v.|收费': { english: 'The museum charges five pounds for admission.', chinese: '这家博物馆收取五英镑门票费。' },
    'v.|指控': { english: 'The police charged him with theft.', chinese: '警方指控他盗窃。' },
    'v.|冲锋': { english: 'The soldiers charged across the field.', chinese: '士兵们冲过了田野。' },
    'v.|充电': { english: 'I need to charge my phone before we leave.', chinese: '出发前我需要给手机充电。' },
    'n.|费用': { english: 'There is an extra charge for delivery.', chinese: '送货需要额外付费。' },
    'n.|指控': { english: 'She denied the charge of theft.', chinese: '她否认了盗窃指控。' },
    'n.|电荷': { english: 'An electron carries a negative charge.', chinese: '电子带负电荷。' }
  },
  run: {
    'v.|跑': { english: 'She runs in the park every morning.', chinese: '她每天早上在公园里跑步。' },
    'v.|经营': { english: 'They run a small bakery together.', chinese: '他们一起经营一家小面包店。' },
    'v.|运转': { english: 'The engine runs smoothly now.', chinese: '发动机现在运转平稳。' },
    'v.|流淌': { english: 'Tears ran down his cheeks.', chinese: '泪水顺着他的脸颊流下。' },
    'n.|跑步': { english: 'I went for a run after work.', chinese: '下班后我去跑了步。' },
    'n.|连续': { english: 'The team enjoyed a run of six victories.', chinese: '这支队伍取得了六连胜。' }
  },
  set: {
    'v.|放置': { english: 'She set the cup on the table.', chinese: '她把杯子放在桌上。' },
    'v.|设定': { english: 'Set the alarm for seven tomorrow morning.', chinese: '把闹钟设定在明早七点。' },
    'v.|落下': { english: 'The sun sets behind those hills.', chinese: '太阳从那些山后落下。' },
    'n.|一套': { english: 'He bought a set of kitchen knives.', chinese: '他买了一套厨刀。' },
    'n.|集合': { english: 'Zero belongs to the set of integers.', chinese: '零属于整数集合。' },
    'n.|场景': { english: 'The film set looked like an old village.', chinese: '电影布景看起来像一座古老的村庄。' }
  },
  take: {
    'v.|拿': { english: 'Please take a clean towel from the shelf.', chinese: '请从架子上拿一条干净毛巾。' },
    'v.|花费': { english: 'The journey takes about two hours.', chinese: '这段旅程大约需要两小时。' },
    'v.|乘坐': { english: 'We take the bus to school.', chinese: '我们乘公交车去学校。' },
    'v.|接受': { english: 'She decided to take the job.', chinese: '她决定接受这份工作。' },
    'v.|拍摄': { english: 'Could you take a photo of us?', chinese: '你能给我们拍张照片吗？' }
  },
  issue: {
    'n.|问题': { english: 'We discussed the issue of food waste.', chinese: '我们讨论了食物浪费的问题。' },
    'n.|期': { english: 'This article appeared in the July issue.', chinese: '这篇文章刊登在七月那一期。' },
    'v.|发布': { english: 'The school issued a statement yesterday.', chinese: '学校昨天发布了一份声明。' },
    'v.|发给': { english: 'Each visitor was issued a badge.', chinese: '每位访客都获发了一枚胸牌。' }
  },
  hold: {
    'v.|握住': { english: 'Hold my hand while we cross the road.', chinese: '过马路时握住我的手。' },
    'v.|举行': { english: 'We will hold a meeting on Friday.', chinese: '我们将在星期五举行会议。' },
    'v.|容纳': { english: 'This room can hold thirty people.', chinese: '这个房间能容纳三十人。' },
    'v.|保持': { english: 'Hold the door open for a moment.', chinese: '让门保持开着一会儿。' },
    'v.|认为': { english: 'They hold that education should be free.', chinese: '他们认为教育应当免费。' },
    'n.|抓': { english: 'Keep a firm hold on the rope.', chinese: '紧紧抓住绳子。' }
  },
  draw: {
    'v.|画': { english: 'The child drew a picture of a cat.', chinese: '孩子画了一只猫。' },
    'v.|拉': { english: 'Draw the curtains before you go to bed.', chinese: '睡觉前把窗帘拉上。' },
    'v.|吸引': { english: 'The festival draws visitors from nearby towns.', chinese: '这个节日吸引了附近城镇的游客。' },
    'v.|提取': { english: 'She drew some money from her account.', chinese: '她从账户里取出了一些钱。' },
    'v.|打成平局': { english: 'The two teams drew 2–2.', chinese: '两队以二比二打成平局。' },
    'n.|平局': { english: 'The match ended in a draw.', chinese: '比赛以平局结束。' }
  },
  mean: {
    'v.|意思是': { english: 'What does this sign mean?', chinese: '这个标志是什么意思？' },
    'v.|打算': { english: 'I meant to call you yesterday.', chinese: '我本打算昨天给你打电话。' },
    'adj.|刻薄的': { english: 'It was mean of him to laugh at her mistake.', chinese: '他嘲笑她的错误，真刻薄。' },
    'n.|平均数': { english: 'The mean of two and six is four.', chinese: '二和六的平均数是四。' }
  },
  address: {
    'n.|地址': { english: 'Write your address on the envelope.', chinese: '在信封上写下你的地址。' },
    'n.|演讲': { english: 'The principal gave a short address.', chinese: '校长作了一段简短的致辞。' },
    'v.|写地址': { english: 'Please address the letter to Ms Green.', chinese: '请在信上写明收信人为格林女士。' },
    'v.|向……讲话': { english: 'She addressed the audience with confidence.', chinese: '她自信地向听众讲话。' },
    'v.|处理': { english: 'We need to address this problem today.', chinese: '我们今天需要处理这个问题。' }
  },
  fine: {
    'adj.|好的': { english: 'That sounds like a fine idea.', chinese: '那听起来是个好主意。' },
    'adj.|细小的': { english: 'The beach is covered with fine sand.', chinese: '海滩上铺满了细沙。' },
    'adj.|晴朗的': { english: 'We had fine weather for our picnic.', chinese: '我们野餐时天气晴朗。' },
    'n.|罚款': { english: 'He paid a fine for parking here.', chinese: '他因在这里停车缴纳了罚款。' },
    'v.|罚款': { english: 'The driver was fined fifty pounds.', chinese: '司机被罚了五十英镑。' },
    'adv.|很好': { english: 'The new printer works fine.', chinese: '新打印机运行得很好。' }
  },
  strike: {
    'v.|打': { english: 'The ball struck the window.', chinese: '球击中了窗户。' },
    'v.|罢工': { english: 'The workers voted to strike.', chinese: '工人们投票决定罢工。' },
    'v.|突然想到': { english: 'It struck me that we had met before.', chinese: '我突然想到我们以前见过面。' },
    'v.|敲': { english: 'The clock struck twelve.', chinese: '钟敲了十二下。' },
    'n.|罢工': { english: 'The strike lasted for three days.', chinese: '这场罢工持续了三天。' },
    'n.|打击': { english: 'A lightning strike damaged the roof.', chinese: '一次雷击损坏了屋顶。' }
  },
  bear: {
    'n.|熊': { english: 'A bear was walking beside the river.', chinese: '一只熊正沿着河边行走。' },
    'v.|承受': { english: 'I cannot bear the noise any longer.', chinese: '我再也忍受不了这噪声了。' },
    'v.|生育': { english: 'She bore three children.', chinese: '她生育了三个孩子。' },
    'v.|携带': { english: 'The visitors came bearing gifts.', chinese: '访客们带着礼物来了。' },
    'v.|具有': { english: 'The two paintings bear a strong resemblance.', chinese: '这两幅画具有很强的相似性。' }
  },
  spring: {
    'n.|春天': { english: 'The garden is full of flowers in spring.', chinese: '春天花园里开满了花。' },
    'n.|弹簧': { english: 'A small spring keeps the lid closed.', chinese: '一根小弹簧使盖子保持闭合。' },
    'n.|泉水': { english: 'We drank water from a mountain spring.', chinese: '我们喝了山泉里的水。' },
    'v.|跳跃': { english: 'The cat sprang onto the chair.', chinese: '猫跳到了椅子上。' },
    'v.|突然出现': { english: 'New shops sprang up near the station.', chinese: '车站附近突然出现了许多新商店。' }
  },
  account: {
    'n.|账户': { english: 'She opened a savings account.', chinese: '她开了一个储蓄账户。' },
    'n.|描述': { english: 'He gave a detailed account of the journey.', chinese: '他详细描述了这段旅程。' },
    'v.|解释': { english: 'How do you account for the missing money?', chinese: '你如何解释这笔钱的失踪？' }
  },
  subject: {
    'n.|主题': { english: 'The subject of our discussion is public transport.', chinese: '我们讨论的主题是公共交通。' },
    'n.|主语': { english: 'In this sentence, the subject is a pronoun.', chinese: '在这个句子中，主语是一个代词。' },
    'adj.|受……支配的': { english: 'All visitors are subject to the same rules.', chinese: '所有访客都受同样规则的约束。' },
    'v.|使遭受': { english: 'The test subjects the material to intense heat.', chinese: '这项测试使材料承受高温。' }
  },
  adapt: {
    'v.|适应': { english: 'It takes time to adapt to a new school.', chinese: '适应一所新学校需要时间。' },
    'v.|改编': { english: 'They adapted the novel for the stage.', chinese: '他们把这部小说改编成了舞台剧。' }
  }
};
