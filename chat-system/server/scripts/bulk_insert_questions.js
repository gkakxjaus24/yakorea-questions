/**
 * ChatGPT/Gemini 생성 질문 일괄 삽입 스크립트
 * 사용법: node scripts/bulk_insert_questions.js <json파일>
 * 또는 DATA 변수에 직접 붙여넣기
 */

require('dotenv').config();
const supabase = require('../src/services/supabase');

// ── ChatGPT 출력 데이터 ──────────────────────────────────────────
const DATA = [
  {
    "intent_id": "trash_disposal",
    "ko": ["쓰레기 어디 버려요?", "분리수거 어디서 해?", "음식물 쓰레기 어디에?", "쓰레기통 어디 있어요?", "라면 국물 어디 버려?", "일반쓰레기 버리는 곳?", "재활용 어디다 버려요?", "음식물은 주방에 버리면 돼요?", "쓰레기 처리 어떻게 해?", "분리수거 해야 돼요?", "각 층에 쓰레기통 있어?", "캔이랑 병 어디 버려?", "쓰레기 버리는 방법 알려줘", "쓰래기 어디 버려요", "복도 쓰레기통 맞아요?", "주방에 음식물 버리나요?", "휴지랑 플라스틱 따로 버려?", "쓰레기?", "버릴 곳 어딨어", "분리배출 어디서 하나요?"],
    "en": ["Where do I throw away trash?", "Where is the trash bin?", "Where can I recycle?", "Where do I put food waste?", "How do I dispose of garbage?", "Is there a bin on each floor?", "Where do I throw this away?", "Can I throw food waste in the kitchen?", "Where for regular trash?", "Where for plastic bottles?", "Trash disposal?", "How to separate trash?", "Where to put cans and bottles?", "Is hallway bin okay?", "Where do I dump ramen soup?", "Garbage where?", "Do I need to sort recyclables?", "food waste where", "where bin", "how trash works here"],
    "zh": ["垃圾扔哪里？", "回收怎么分类？", "厨余垃圾放哪里？", "垃圾桶在哪里？", "每层都有垃圾桶吗？", "一般垃圾丢哪里？", "塑料瓶丢哪儿？", "食物垃圾是在厨房吗？", "怎么扔垃圾？", "需要分类吗？", "走廊垃圾桶可以吗？", "罐子和瓶子放哪里？", "垃圾处理方法？", "泡面汤倒哪里？", "垃圾？", "哪里可以扔掉？", "食物残渣在哪扔", "回收垃圾桶在哪", "扔垃圾怎么弄", "垃圾分类要怎么做"],
    "ja": ["ゴミどこに捨てる？", "分別どこでする？", "生ゴミはどこ？", "ゴミ箱どこにありますか？", "各階にゴミ箱ある？", "普通ゴミどこ？", "ペットボトルどこに捨てる？", "食べ物のゴミはキッチン？", "ゴミの捨て方教えて", "分別必要ですか？", "廊下のゴミ箱でいい？", "缶と瓶はどこ？", "ラーメンの汁どこ捨てる？", "ゴミ処理どうする？", "ゴミ？", "捨てる場所どこ", "生ごみ捨て場所", "リサイクルどこ", "ゴミ分けないとだめ？", "どこに捨てればいいですか"],
    "ru": ["Куда выбрасывать мусор?", "Где мусорка?", "Куда выбросить пищевые отходы?", "Где сортировка мусора?", "На каждом этаже есть урна?", "Куда обычный мусор?", "Куда бутылки и банки?", "Пищевой мусор на кухне?", "Как выбрасывать мусор?", "Нужно сортировать?", "Можно в коридорную урну?", "Куда вылить суп?", "Где контейнер для мусора?", "Мусор куда?", "Как тут с мусором?", "Куда кидать пластик?", "Раздельный сбор где?", "Еду куда выбросить", "Урна где", "Какой порядок выброса мусора?"],
    "es": ["¿Dónde tiro la basura?", "¿Dónde está el basurero?", "¿Dónde va el reciclaje?", "¿Dónde tiro comida?", "¿Cómo se bota la basura?", "¿Hay basurero en cada piso?", "¿Dónde va la basura normal?", "¿Dónde tiro botellas?", "¿La basura de comida va en la cocina?", "¿Hay que separar?", "¿Sirve el bote del pasillo?", "¿Dónde van latas y botellas?", "¿Cómo funciona la basura aquí?", "¿Dónde tiro sopa o restos?", "¿Basura?", "¿Dónde puedo botarla?", "¿Residuos de comida dónde?", "¿Reciclaje dónde va?", "¿Cómo separar la basura?", "¿Dónde se hace la separación?"]
  },
  {
    "intent_id": "common_area_lights",
    "ko": ["복도 불 몇시에 꺼져요?", "주방 조명 언제 켜져?", "공용등 자동이에요?", "복도 불 안 켜져요", "주방 불 안들어와요", "조명 몇시에 꺼짐?", "아침에 불 몇시에 켜져?", "밤 11시에 꺼져요?", "공용 공간 불 시간?", "복도 조명 시간 알려줘", "주방 불 자동으로 꺼져?", "공용등 수동으로 켜도 돼?", "복도 불 왜 꺼졌어요?", "주방 불 언제 꺼져요?", "등이 안켜저요", "공용조명?", "불 몇시부터 켜짐", "밤에 복도 불 켜놔요?", "자동 점등 맞아요?", "조명 시간표 있어요?"],
    "en": ["What time do the hallway lights turn off?", "When do the kitchen lights turn on?", "Are the common lights automatic?", "The hallway light is off", "Kitchen light not working?", "What time do lights go off?", "What time do lights come on in the morning?", "Do they turn off at 11 pm?", "Common area light schedule?", "Why are the hallway lights off?", "Can I turn on the common lights manually?", "When does kitchen light turn off?", "Lights not on", "Hallway lights when?", "Kitchen lights automatic?", "What time lights on?", "What time lights off?", "common lights?", "Is it auto on?", "Do corridor lights stay on at night?"],
    "zh": ["走廊灯几点关？", "厨房灯几点开？", "公共区域的灯是自动的吗？", "走廊灯没亮", "厨房灯不亮", "灯几点关？", "早上几点开灯？", "晚上11点会关吗？", "公共照明时间？", "为什么走廊灯关了？", "厨房灯什么时候关？", "可以手动开灯吗？", "灯没开", "走廊灯什么时候亮？", "厨房灯自动吗？", "几点开灯", "几点关灯", "公共灯？", "是自动开关吗？", "晚上走廊有灯吗？"],
    "ja": ["廊下の電気何時に消える？", "キッチンの電気いつ点く？", "共用の電気は自動？", "廊下の電気ついてない", "キッチンの電気つかない", "電気何時に消灯？", "朝は何時に点灯？", "夜11時に消える？", "共用照明の時間は？", "なんで廊下暗いの？", "キッチンの電気いつ消える？", "手動でつけてもいい？", "電気つかない", "廊下のライトいつ？", "自動点灯ですか？", "何時につく？", "何時に消える？", "共用ライト？", "夜も廊下明るい？", "照明スケジュールある？"],
    "ru": ["Во сколько выключается свет в коридоре?", "Когда включается свет на кухне?", "Свет в общих зонах автоматический?", "В коридоре темно", "На кухне свет не горит", "Во сколько выключают свет?", "Во сколько включают утром?", "В 11 вечера выключается?", "Расписание света?", "Почему в коридоре темно?", "Можно включить вручную?", "Когда выключается кухня?", "Свет не включается", "Коридорный свет когда?", "Это автоматом?", "Во сколько включение?", "Во сколько выключение?", "Общий свет?", "Ночью свет есть?", "Когда горит свет в общих местах?"],
    "es": ["¿A qué hora se apaga la luz del pasillo?", "¿Cuándo se enciende la luz de la cocina?", "¿Las luces comunes son automáticas?", "La luz del pasillo está apagada", "La luz de la cocina no prende", "¿A qué hora se apagan?", "¿A qué hora prenden en la mañana?", "¿Se apagan a las 11?", "¿Horario de luces comunes?", "¿Por qué está oscuro el pasillo?", "¿Puedo prenderla manual?", "¿Cuándo se apaga la cocina?", "La luz no enciende", "¿Luces del pasillo cuándo?", "¿Es automático?", "¿A qué hora enciende?", "¿A qué hora apaga?", "¿Luces comunes?", "¿Hay luz en la noche?", "¿Tienen horario de iluminación?"]
  },
  {
    "intent_id": "door_lock_help",
    "ko": ["도어락이 안열려요", "비밀번호 맞는데 문이 안열려", "문 여는 방법 알려줘", "도어락 어떻게 열어요?", "손바닥 어디에 대요?", "화면 먼저 쓸어야 해요?", "비번 입력 전에 뭐해?", "문이 계속 안열림", "도어락 에러인가요?", "잠금장치 사용법?", "비밀번호 눌러도 안돼요", "문 열기 도와줘", "도어락?", "손으로 위에서 아래 맞아요?", "화면 켜는 법?", "왜 안열리지", "문 열려면 어떻게?", "비번 전에 터치해야 돼?", "도어락 안되여", "비밀번호 입력 순서 뭐야"],
    "en": ["The door lock won't open", "The password is correct but door won't open", "How do I open the door?", "How to use the door lock?", "Do I need to touch the screen first?", "What do I do before entering the code?", "Door lock not working", "Help with the lock", "Where do I put my hand?", "Do I swipe first?", "The door keeps not opening", "Lock error?", "I entered the code but no open", "Door lock help", "How to turn on the screen?", "Why isn't it opening?", "Need to swipe top to bottom?", "Code before or after touch?", "lock not open", "door password help"],
    "zh": ["门锁打不开", "密码对但门不开", "怎么开门？", "门锁怎么用？", "要先摸屏幕吗？", "输入密码前要做什么？", "门锁坏了吗？", "帮我开一下门锁", "手要放哪里？", "要先往下滑吗？", "门一直打不开", "锁有问题吗？", "密码输了也不行", "门锁帮助", "屏幕怎么亮？", "为什么打不开？", "要先从上往下滑？", "先按还是先滑？", "锁开不了", "门密码怎么弄"],
    "ja": ["ドアロック開かない", "暗証番号合ってるのに開かない", "どうやって開ける？", "ドアロックの使い方？", "先に画面触る？", "番号入力前に何する？", "ロック壊れてる？", "開けるの手伝って", "手はどこに置く？", "先に上から下にする？", "ずっと開かない", "エラーですか？", "番号入れてもだめ", "ドアロックヘルプ", "画面どうやってつける？", "なんで開かない？", "先にスワイプ必要？", "タッチしてから番号？", "ロック開け方", "パスワードの順番は？"],
    "ru": ["Замок не открывается", "Код верный, но дверь не открывается", "Как открыть дверь?", "Как пользоваться замком?", "Нужно сначала коснуться экрана?", "Что делать перед вводом кода?", "Замок не работает", "Помогите с замком", "Куда приложить руку?", "Сначала провести сверху вниз?", "Дверь не открывается", "Ошибка замка?", "Ввожу код, не открывает", "Помощь с дверным замком", "Как включить экран?", "Почему не открывается?", "Нужно сначала свайпнуть?", "Код до или после касания?", "Замок не открывает", "Помогите открыть дверь"],
    "es": ["La cerradura no abre", "La contraseña está bien pero no abre", "¿Cómo abro la puerta?", "¿Cómo usar la cerradura?", "¿Tengo que tocar la pantalla primero?", "¿Qué hago antes del código?", "La cerradura no funciona", "Ayuda con la puerta", "¿Dónde pongo la mano?", "¿Primero deslizo?", "La puerta no abre", "¿Error de cerradura?", "Pongo el código y nada", "Ayuda cerradura", "¿Cómo prender la pantalla?", "¿Por qué no abre?", "¿Hay que deslizar de arriba abajo?", "¿Código antes o después?", "lock no abre", "ayuda con contraseña puerta"]
  },
  {
    "intent_id": "locker_help",
    "ko": ["사물함이 안열려요", "락커 어떻게 열어?", "번호 누르고도 안열려", "사물함 여는 방법?", "4자리 비번 어디 눌러?", "위에서 아래로 누르라는게 뭐야?", "손잡이 어떻게 돌려요?", "사물함 열기 도와줘", "락커 사용법 알려줘", "문이 안열림", "번호 맞는데 안돼요", "왼쪽으로 돌리는 거 맞아?", "사물함?", "열쇠 없어요?", "비밀번호 입력 순서?", "사물함 안되여", "어떻게 여는지 모르겠어요", "손잡이 안돌아가", "번호 누른 뒤 뭐해?", "락커 도와주세요"],
    "en": ["The locker won't open", "How do I open the locker?", "I entered the code but it won't open", "Locker opening method?", "Where do I enter the 4-digit code?", "What does press top to bottom mean?", "How do I turn the handle?", "Help me open the locker", "Locker instructions?", "Door not opening", "The code is right but not working", "Turn left correct?", "Locker help", "No key?", "What order do I press?", "locker not work", "I don't know how to open it", "Handle won't turn", "What after entering code?", "Can you help with locker?"],
    "zh": ["储物柜打不开", "柜子怎么开？", "输入密码也打不开", "储物柜怎么开？", "4位密码在哪里按？", "从上往下按是什么意思？", "把手怎么转？", "帮我开一下柜子", "储物柜使用方法？", "门打不开", "密码对但不行", "要往左转对吗？", "柜子帮助", "没有钥匙吗？", "密码输入顺序？", "柜子打不开了", "我不知道怎么开", "把手转不动", "输完密码后做什么？", "能帮我一下吗"],
    "ja": ["ロッカー開かない", "ロッカーどうやって開ける？", "番号入れても開かない", "開け方教えて", "4桁の番号どこ押す？", "上から下に押すって何？", "取っ手どう回す？", "ロッカー開けるの手伝って", "使い方は？", "ドア開かない", "番号合ってるのにだめ", "左に回すで合ってる？", "ロッカー？", "鍵ないの？", "入力の順番は？", "ロッカー使えない", "どう開けるかわからない", "取っ手回らない", "番号のあと何する？", "助けてください"],
    "ru": ["Шкафчик не открывается", "Как открыть локер?", "Ввёл код, но не открывается", "Как открыть шкафчик?", "Куда вводить 4 цифры?", "Что значит нажимать сверху вниз?", "Как повернуть ручку?", "Помогите открыть локер", "Инструкция по локеру?", "Дверца не открывается", "Код правильный, но не работает", "Нужно влево повернуть?", "Помощь с локером", "Ключа нет?", "Порядок ввода?", "Локер не работает", "Не понимаю как открыть", "Ручка не крутится", "Что после кода?", "Поможете с шкафчиком?"],
    "es": ["El locker no abre", "¿Cómo abro el locker?", "Puse el código y no abre", "¿Método para abrir?", "¿Dónde pongo los 4 números?", "¿Qué significa apretar de arriba abajo?", "¿Cómo giro la manija?", "Ayuda para abrir el locker", "¿Instrucciones del locker?", "La puerta no abre", "El código está bien pero no funciona", "¿Se gira a la izquierda?", "Ayuda locker", "¿No hay llave?", "¿Orden del código?", "locker no funciona", "No sé cómo abrirlo", "La manija no gira", "¿Qué hago después del código?", "¿Me ayudas con el locker?"]
  },
  {
    "intent_id": "password_change",
    "ko": ["비밀번호 바꿀 수 있어요?", "도어락 비번 변경 가능?", "오늘 바로 바꿔줘요", "지금 비밀번호 변경 돼?", "사물함 비밀번호 바꾸고 싶어요", "비번 변경 어떻게 해?", "즉시 변경 안돼요?", "내일 바뀌어요?", "직원한테 요청하면 돼?", "비밀번호 변경 요청", "오늘 안되나요?", "비번 바꾸고 싶어", "비밀번호 수정 가능?", "언제 바꿔줘요?", "바로 변경 안돼?", "비번 변경 부탁", "도어락 번호 바꾸기", "패스워드 체인지?", "내일 오전에 가능?", "비번 변경 안되여"],
    "en": ["Can I change the password?", "Can the door code be changed?", "Can you change it today?", "Can I change the password now?", "I want to change the locker code", "How do I change the code?", "Can't change immediately?", "Will it be changed tomorrow?", "Do I need to ask staff?", "Password change request", "Not possible today?", "I want a new password", "Can I edit the code?", "When can it be changed?", "Not right away?", "Please change the password", "Change door lock code", "password change?", "Possible tomorrow morning?", "code change not now?"],
    "zh": ["可以改密码吗？", "门锁密码能改吗？", "今天能马上改吗？", "现在可以改密码吗？", "我想改储物柜密码", "怎么改密码？", "不能立刻改吗？", "明天会改吗？", "要跟员工说吗？", "申请改密码", "今天不行吗？", "我想换密码", "可以修改吗？", "什么时候能改？", "不能马上处理？", "请帮我改密码", "改门锁密码", "password change?", "明天上午可以吗？", "密码不能马上改？"],
    "ja": ["パスワード変えられる？", "ドアの暗証番号変更できる？", "今日すぐ変えられる？", "今変更できる？", "ロッカーの番号変えたい", "どうやって変える？", "すぐは無理？", "明日変わる？", "スタッフに頼めばいい？", "変更お願い", "今日だめですか？", "新しい番号にしたい", "修正できますか？", "いつ変更できる？", "すぐ変更不可？", "パスワード変更してください", "ドアロック番号変更", "password change?", "明日の朝可能？", "番号変更できない？"],
    "ru": ["Можно сменить пароль?", "Можно изменить код двери?", "Можно сегодня сразу поменять?", "Сейчас можно сменить пароль?", "Хочу поменять код шкафчика", "Как сменить код?", "Сразу нельзя?", "Завтра поменяют?", "Нужно просить сотрудника?", "Запрос на смену пароля", "Сегодня нельзя?", "Хочу новый код", "Можно изменить?", "Когда смогут поменять?", "Не сразу?", "Поменяйте пароль, пожалуйста", "Сменить код замка", "password change?", "Можно завтра утром?", "Код нельзя сразу сменить?"],
    "es": ["¿Puedo cambiar la contraseña?", "¿Se puede cambiar el código de la puerta?", "¿Lo pueden cambiar hoy?", "¿Puedo cambiarla ahora?", "Quiero cambiar el código del locker", "¿Cómo cambio el código?", "¿No se puede al instante?", "¿Se cambia mañana?", "¿Tengo que pedir al staff?", "Solicitud de cambio", "¿Hoy no se puede?", "Quiero otra contraseña", "¿Se puede modificar?", "¿Cuándo la cambian?", "¿No se puede ya?", "Por favor cambien la contraseña", "Cambiar código de puerta", "password change?", "¿Mañana en la mañana?", "¿No se puede ahora?"]
  },
  {
    "intent_id": "laundry_info",
    "ko": ["세탁 어떻게 해요?", "빨래 맡기면 돼요?", "세탁비 얼마예요?", "건조도 해줘요?", "세탁+건조 같이 돼?", "세탁 어디에 맡겨?", "빨래는 어디 두나요?", "세탁 가방 어디 있어?", "현금 넣어서 맡기면 돼요?", "세탁 서비스 있나요?", "빨래 비용?", "세탁 방법 알려줘", "건조 포함인가요?", "세탁 몇시에 맡겨?", "세탁 가능해요?", "빨래 맡기고 싶어요", "세탁기 직접 써요?", "세탁?", "세탁 건조 가격", "빨래 어떻게 맡기는지"],
    "en": ["How do I do laundry?", "Can I leave my clothes for laundry?", "How much is laundry?", "Do you also dry clothes?", "Laundry and drying together?", "Where do I leave my laundry?", "Where do I put my clothes?", "Where is the laundry bag?", "Do I put cash in with the clothes?", "Is there a laundry service?", "Laundry cost?", "How does laundry work?", "Drying included?", "What time can I leave laundry?", "Can I do laundry?", "I want to wash clothes", "Do I use the machine myself?", "laundry?", "Price for wash and dry", "How to send laundry"],
    "zh": ["洗衣怎么弄？", "可以把衣服拿去洗吗？", "洗衣多少钱？", "也会烘干吗？", "洗+烘一起吗？", "衣服放哪里？", "洗衣交到哪里？", "洗衣袋在哪里？", "现金要一起放进去吗？", "有洗衣服务吗？", "洗衣费用？", "洗衣流程？", "包含烘干吗？", "什么时候可以送洗？", "可以洗衣吗？", "我想洗衣服", "是自己用机器吗？", "洗衣？", "洗加烘价格", "怎么送洗"],
    "ja": ["洗濯どうする？", "洗濯お願いできる？", "洗濯いくら？", "乾燥もしてくれる？", "洗濯と乾燥セット？", "どこに出す？", "服はどこに置く？", "ランドリーバッグどこ？", "現金も一緒に入れる？", "洗濯サービスある？", "料金は？", "やり方教えて", "乾燥込み？", "何時に出せる？", "洗濯できますか？", "服洗いたい", "自分で機械使う？", "洗濯？", "洗濯乾燥の値段", "どうやって出すの？"],
    "ru": ["Как сделать стирку?", "Можно отдать одежду в стирку?", "Сколько стоит стирка?", "Сушка тоже есть?", "Стирка и сушка вместе?", "Куда отдать вещи?", "Где оставить одежду?", "Где мешок для стирки?", "Нужно положить наличные вместе?", "Есть услуга стирки?", "Цена стирки?", "Как это работает?", "Сушка включена?", "Во сколько можно сдать?", "Можно постирать?", "Хочу постирать вещи", "Самому пользоваться машиной?", "стирка?", "Цена стирка+сушка", "Как сдать бельё"],
    "es": ["¿Cómo hago la lavandería?", "¿Puedo dejar ropa para lavar?", "¿Cuánto cuesta?", "¿También secan la ropa?", "¿Lavado y secado juntos?", "¿Dónde dejo la ropa?", "¿Dónde pongo mi ropa?", "¿Dónde está la bolsa de lavandería?", "¿Pongo efectivo con la ropa?", "¿Hay servicio de lavandería?", "¿Costo de lavado?", "¿Cómo funciona?", "¿Incluye secado?", "¿A qué hora puedo dejarla?", "¿Puedo lavar ropa?", "Quiero lavar mi ropa", "¿Uso yo la máquina?", "lavandería?", "Precio lavado y secado", "¿Cómo se entrega la ropa?"]
  },
  {
    "intent_id": "laundry_payment",
    "ko": ["세탁비 카드 돼요?", "세탁 결제 어떻게 해요?", "계좌이체 가능?", "현금만 받아요?", "카드 안돼요?", "세탁비 현금만?", "송금해도 돼?", "현금 없는데 어떡해요", "세탁 결제 방법", "세탁비 결제", "카카오페이 돼요?", "현금 말고 안돼?", "세탁 카드결제 가능?", "세탁비 이체 되나", "payment for laundry?", "얼마를 현금으로 넣어야 해?", "현금만 가능해요?", "카드랑 이체 둘 다 안돼?", "세탁 돈 어떻게 내", "빨래 결제 뭐로 해"],
    "en": ["Can I pay laundry by card?", "How do I pay for laundry?", "Can I do bank transfer?", "Cash only?", "Card not accepted?", "Laundry payment cash only?", "Can I send money?", "I don't have cash", "Laundry payment method?", "How to pay laundry fee?", "Do you take Kakao Pay?", "No payment except cash?", "Can I pay by card for laundry?", "Transfer okay for laundry?", "payment for laundry?", "How much cash should I put?", "Only cash possible?", "No card and no transfer?", "How do I pay for washing?", "Laundry fee how pay"],
    "zh": ["洗衣可以刷卡吗？", "洗衣怎么付款？", "可以转账吗？", "只能现金吗？", "不能刷卡吗？", "洗衣费只能现金？", "可以手机转账吗？", "我没有现金怎么办？", "洗衣付款方式？", "洗衣费怎么付？", "可以用Kakao Pay吗？", "除了现金都不行吗？", "洗衣可以刷卡付款吗？", "洗衣费可以转账吗？", "laundry payment?", "要放多少现金？", "只能付现金？", "卡和转账都不行？", "洗衣钱怎么付", "洗衣收费怎么交"],
    "ja": ["洗濯代カード使える？", "洗濯の支払いどうする？", "振込できる？", "現金のみ？", "カードだめ？", "洗濯代は現金だけ？", "送金でもいい？", "現金ないです", "支払い方法は？", "洗濯代どう払う？", "カカオペイ使える？", "現金以外不可？", "カード払い可能？", "振込OK？", "payment for laundry?", "いくら現金入れる？", "現金だけですか？", "カードも振込もだめ？", "どう払えばいい？", "洗濯料金の払い方"],
    "ru": ["Можно оплатить стирку картой?", "Как оплатить стирку?", "Можно переводом?", "Только наличные?", "Карта не принимается?", "Оплата стирки только наличными?", "Можно отправить перевод?", "У меня нет наличных", "Способ оплаты стирки?", "Как платить за стирку?", "Можно Kakao Pay?", "Кроме наличных нельзя?", "Картой за стирку можно?", "Перевод за стирку можно?", "payment for laundry?", "Сколько наличных класть?", "Только наличка?", "И карта и перевод нельзя?", "Как оплатить стирку", "Чем платить за прачку?"],
    "es": ["¿Puedo pagar lavandería con tarjeta?", "¿Cómo pago la lavandería?", "¿Se puede transferencia?", "¿Solo efectivo?", "¿No aceptan tarjeta?", "¿Lavandería solo en efectivo?", "¿Puedo enviar dinero?", "No tengo efectivo", "¿Método de pago?", "¿Cómo pagar la ropa?", "¿Aceptan Kakao Pay?", "¿Nada aparte de efectivo?", "¿Puedo pagar con tarjeta?", "¿Transferencia sirve?", "payment for laundry?", "¿Cuánto efectivo pongo?", "¿Solo efectivo de verdad?", "¿Ni tarjeta ni transferencia?", "¿Cómo pago el lavado?", "¿Con qué se paga la lavandería?"]
  },
  {
    "intent_id": "towel_exchange",
    "ko": ["수건 어디서 바꿔요?", "새 수건 어떻게 받아?", "쓴 수건 반납 어디?", "수건 교환 가능해요?", "수건 더 받을 수 있어요?", "수건 어디에 있어?", "지하는 수건 어디서 가져가?", "2층에서 가져가면 돼요?", "사용한 수건은 어디 둬?", "수건 교체 방법?", "새 수건 가져가도 돼?", "수건 바꾸고 싶어요", "타월 교환?", "지하 샤워실 앞 맞아요?", "수건 부족해요", "추가 수건 가능?", "수건 어디 반납?", "수건 안보여요", "교환 장소 어디", "수건 바꾸는 법"],
    "en": ["Where do I change towels?", "How do I get a new towel?", "Where do I return used towels?", "Can I exchange towels?", "Can I get an extra towel?", "Where are the towels?", "Where do I get towels in the basement?", "Do I get it on the 2nd floor?", "Where do I put used towels?", "Towel exchange how?", "Can I take a fresh towel?", "I want to change my towel", "towel exchange?", "Is it in front of the basement shower?", "No towels left", "Extra towel possible?", "Where return towel?", "I can't find towels", "Where is the exchange spot?", "How towel replacement works"],
    "zh": ["毛巾在哪里换？", "怎么拿新毛巾？", "用过的毛巾放哪里？", "可以换毛巾吗？", "可以多拿一条吗？", "毛巾在哪里？", "地下室的毛巾在哪拿？", "是在2楼拿吗？", "旧毛巾放哪里？", "毛巾更换方法？", "可以拿新的吗？", "我想换毛巾", "towel exchange?", "是在地下淋浴间前面吗？", "毛巾不够", "可以多给一条吗？", "毛巾哪里归还？", "我没看到毛巾", "更换地点在哪", "毛巾怎么换"],
    "ja": ["タオルどこで交換？", "新しいタオルどうやってもらう？", "使ったタオル返却どこ？", "タオル交換できますか？", "追加でもらえる？", "タオルどこにある？", "地下はどこでもらう？", "2階でもらえばいい？", "使用済みどこ置く？", "交換方法は？", "新しいの取っていい？", "タオル替えたい", "towel exchange?", "地下シャワー前で合ってる？", "タオル足りない", "追加タオル可能？", "返す場所どこ？", "見つからない", "交換場所どこ", "タオルの替え方"],
    "ru": ["Где менять полотенце?", "Как получить новое полотенце?", "Куда вернуть использованное?", "Можно обменять полотенце?", "Можно ещё одно?", "Где полотенца?", "Где взять в подвале?", "На 2 этаже брать?", "Куда класть использованное?", "Как работает обмен?", "Можно взять чистое?", "Хочу поменять полотенце", "towel exchange?", "Перед душевой в подвале?", "Полотенец не хватает", "Дополнительное можно?", "Куда сдавать полотенце?", "Не вижу полотенца", "Где место обмена?", "Как поменять полотенце"],
    "es": ["¿Dónde cambio la toalla?", "¿Cómo consigo una toalla nueva?", "¿Dónde dejo la toalla usada?", "¿Se puede cambiar la toalla?", "¿Puedo recibir otra?", "¿Dónde están las toallas?", "¿Dónde tomo toalla en el sótano?", "¿Es en el segundo piso?", "¿Dónde pongo la usada?", "¿Cómo funciona el cambio?", "¿Puedo tomar una limpia?", "Quiero cambiar mi toalla", "towel exchange?", "¿Es frente a la ducha del sótano?", "No hay toallas", "¿Toalla extra posible?", "¿Dónde devuelvo la toalla?", "No veo toallas", "¿Lugar de cambio?", "¿Cómo se cambia la toalla?"]
  },
  {
    "intent_id": "slipper_info",
    "ko": ["슬리퍼 어디서 받아요?", "체크인할 때 슬리퍼 줘요?", "슬리퍼 꼭 신어야 해요?", "실내에서 신발 안돼요?", "신발 신고 다니면 안돼?", "슬리퍼 없어요", "슬리퍼 추가로 받을 수 있어?", "슬리퍼는 프런트에 있나요?", "방에 신발 가져가도 돼?", "실내화 필수예요?", "슬리퍼 정보 알려줘", "체크인 때 안받았어요", "슬리퍼 어디?", "신발 벗어야 돼요?", "슬리퍼 새로 받아도 돼?", "실내에서는 뭐 신어?", "슬리퍼 제공?", "방 안에 신발 둬도 돼?", "슬리퍼 안받앗어요", "신발 가져가도 되는지"],
    "en": ["Where do I get slippers?", "Do you give slippers at check-in?", "Do I have to wear slippers inside?", "No shoes inside?", "Can I walk with shoes on?", "I don't have slippers", "Can I get an extra pair?", "Are slippers at the front desk?", "Can I bring my shoes into the room?", "Are indoor slippers required?", "Slipper info please", "I didn't get slippers at check-in", "slippers where?", "Do I need to take off shoes?", "Can I get new slippers?", "What do I wear inside?", "Do you provide slippers?", "Can I keep shoes in the room?", "I didnt get slippers", "Can I bring shoes upstairs?"],
    "zh": ["拖鞋在哪里拿？", "入住时会给拖鞋吗？", "室内必须穿拖鞋吗？", "里面不能穿鞋吗？", "可以穿鞋走吗？", "我没有拖鞋", "可以再给一双吗？", "拖鞋在前台吗？", "鞋子可以带进房间吗？", "室内拖鞋是必须的吗？", "拖鞋信息", "入住时没拿到", "拖鞋？", "要脱鞋吗？", "可以换新的拖鞋吗？", "室内穿什么？", "有提供拖鞋吗？", "鞋可以放房间吗？", "我没拿到拖鞋", "鞋子能带进去吗"],
    "ja": ["スリッパどこでもらう？", "チェックインの時にもらえる？", "室内で必ず履く？", "中では靴だめ？", "靴のまま歩いたらだめ？", "スリッパないです", "追加でもらえる？", "フロントにある？", "靴を部屋に持っていっていい？", "室内履き必須？", "スリッパ情報", "チェックインで受け取ってない", "スリッパどこ？", "靴脱ぐ必要ある？", "新しいスリッパもらえる？", "中では何履く？", "提供ありますか？", "部屋に靴置いていい？", "スリッパもらってない", "靴持ち込みOK？"],
    "ru": ["Где взять тапочки?", "Выдаёте тапочки при заезде?", "Нужно обязательно носить тапочки внутри?", "В обуви нельзя?", "Можно ходить в обуви?", "У меня нет тапочек", "Можно ещё пару?", "Тапочки на ресепшене?", "Можно взять обувь в комнату?", "Тапочки обязательны?", "Информация о тапочках", "Мне не дали при заезде", "Тапочки где?", "Нужно снимать обувь?", "Можно новые тапочки?", "Что носить внутри?", "Вы даёте тапочки?", "Обувь можно держать в комнате?", "Мне не дали тапочки", "Можно с обувью наверх?"],
    "es": ["¿Dónde consigo pantuflas?", "¿Dan pantuflas al hacer check-in?", "¿Tengo que usar pantuflas adentro?", "¿No se puede usar zapatos adentro?", "¿Puedo caminar con zapatos?", "No tengo pantuflas", "¿Me pueden dar otro par?", "¿Las pantuflas están en recepción?", "¿Puedo llevar mis zapatos al cuarto?", "¿Es obligatorio usar pantuflas?", "Info de pantuflas", "No me dieron en check-in", "¿Pantuflas dónde?", "¿Hay que quitarse los zapatos?", "¿Puedo recibir nuevas?", "¿Qué uso adentro?", "¿Ustedes dan pantuflas?", "¿Puedo guardar zapatos en la habitación?", "No recibí pantuflas", "¿Puedo subir con zapatos?"]
  },
  {
    "intent_id": "luggage_storage",
    "ko": ["짐 보관 가능해요?", "가방 어디 맡겨요?", "체크인 전 짐 맡길 수 있어?", "체크아웃 후에도 짐 보관 돼요?", "짐 맡기는 곳 어디?", "카운터 앞에 두면 돼요?", "장기 보관 가능?", "짐 며칠 맡길 수 있어요?", "3일 넘으면 얼마예요?", "짐 보관 무료인가요?", "캐리어 맡기고 싶어요", "짐 보관 방법 알려줘", "수하물 보관?", "짐 두고 나가도 돼?", "가방 맡아줘요?", "장기짐 보관 비용?", "체크아웃 뒤 짐", "짐 어디에 놔요", "보관료 있어요?", "캐리어 며칠 가능?"],
    "en": ["Can I store my luggage?", "Where can I leave my bags?", "Can I leave luggage before check-in?", "Can I store luggage after check-out?", "Where is luggage storage?", "Can I leave it in front of the counter?", "Long-term storage possible?", "How many days can I store luggage?", "How much after 3 days?", "Is luggage storage free?", "I want to leave my suitcase", "How does luggage storage work?", "Baggage storage?", "Can I leave my bag and go out?", "Do you keep bags?", "Long-term luggage fee?", "Luggage after check-out?", "Where do I put my suitcase?", "Is there a storage charge?", "How long can suitcase stay?"],
    "zh": ["可以寄存行李吗？", "行李放哪里？", "入住前可以放行李吗？", "退房后也能寄存吗？", "寄存处在哪里？", "放在柜台前可以吗？", "可以长期寄存吗？", "行李可以放几天？", "超过3天多少钱？", "寄存免费吗？", "我想放行李箱", "行李寄存怎么操作？", "行李寄存？", "可以先放着出去吗？", "你们可以保管吗？", "长期寄存费用？", "退房后行李", "行李放哪儿", "有保管费吗？", "箱子能放几天？"],
    "ja": ["荷物預かりできますか？", "バッグどこに置く？", "チェックイン前に預けられる？", "チェックアウト後も預けられる？", "荷物置き場どこ？", "カウンター前でいい？", "長期保管できる？", "何日預けられる？", "3日過ぎたらいくら？", "無料ですか？", "スーツケース預けたい", "預かり方法教えて", "荷物保管？", "置いて外出していい？", "預かってくれる？", "長期保管料金？", "チェックアウト後の荷物", "どこに置けばいい？", "保管料ある？", "何日まで可能？"],
    "ru": ["Можно оставить багаж?", "Где оставить сумки?", "Можно до заезда оставить?", "После выезда тоже можно?", "Где хранение багажа?", "Можно оставить перед стойкой?", "Долгое хранение возможно?", "На сколько дней можно оставить?", "Сколько стоит после 3 дней?", "Хранение бесплатно?", "Хочу оставить чемодан", "Как работает хранение багажа?", "Камера хранения?", "Можно оставить и уйти?", "Вы храните сумки?", "Цена за долгое хранение?", "Багаж после выезда?", "Куда поставить чемодан?", "Есть плата за хранение?", "На сколько можно оставить чемодан?"],
    "es": ["¿Puedo guardar mi equipaje?", "¿Dónde dejo las maletas?", "¿Puedo dejar equipaje antes del check-in?", "¿También después del check-out?", "¿Dónde está el lugar para equipaje?", "¿Lo dejo frente al mostrador?", "¿Se puede guardar largo tiempo?", "¿Cuántos días puedo dejarlo?", "¿Cuánto cuesta después de 3 días?", "¿Es gratis?", "Quiero dejar mi maleta", "¿Cómo funciona el guardaequipaje?", "¿Guardaequipaje?", "¿Puedo dejarlo e irme?", "¿Guardan maletas?", "¿Costo por largo tiempo?", "Equipaje después de salida", "¿Dónde pongo la maleta?", "¿Hay cargo por guardar?", "¿Cuántos días puedo dejar la maleta?"]
  },
  {
    "intent_id": "breakfast_info",
    "ko": ["조식 몇시야?", "아침밥 시간 언제?", "조식 언제 먹어요?", "아침 제공해요?", "조식 몇시부터 몇시까지?", "조식 어디서 먹어?", "breakfast time?", "아침 몇시에 시작해요?", "조식 포함인가요?", "아침 먹을 수 있어요?", "조식 언제 끝나요?", "몇시에 가면 아침 먹어요?", "아침은 무료에요?", "조식 장소 어디?", "아침 식사 몇시?", "조식 셀프인가요?", "아침 제공되나요?", "breakfast 어디?", "아침 몇시까지?", "조식 시간 알려줘"],
    "en": ["What time is breakfast?", "Breakfast time?", "When is breakfast?", "Do you have breakfast?", "Is breakfast included?", "What time breakfast start?", "Breakfast from when to when?", "Where is breakfast?", "Can I eat breakfast?", "breakfast pls time", "What hour breakfast?", "Is it free breakfast?", "Breakfast finish time?", "Morning meal time?", "Self breakfast?", "Where eat breakfast?", "Breakfast at lobby?", "Can I get breakfast now?", "What time morning food?", "Breakfast info pls"],
    "zh": ["早餐几点？", "早餐时间是什么？", "什么时候有早餐？", "有提供早餐吗？", "早餐几点到几点？", "早餐在哪里吃？", "早餐免费吗？", "几点开始吃早餐？", "早餐几点结束？", "早餐时间告诉我", "可以吃早餐吗？", "早餐在一楼吗？", "早餐是自助吗？", "什么时候去吃早餐？", "早餐有吗？", "几点可以吃早餐？", "早餐在哪里？", "早饭时间？", "早餐几点开始结束", "早餐信息"],
    "ja": ["朝食何時？", "朝ごはん時間？", "朝食いつ？", "朝食ありますか？", "朝食何時から何時まで？", "朝食どこで食べる？", "無料ですか？", "何時開始？", "朝食終わり何時？", "朝食時間教えて", "食べられる？", "ロビーですか？", "セルフですか？", "朝ごはんある？", "いつ行けばいい？", "朝食場所どこ？", "朝食時間は？", "今食べれる？", "朝食ある？", "朝ごはん時間何時"],
    "ru": ["Во сколько завтрак?", "Завтрак когда?", "Есть завтрак?", "Во сколько начинается завтрак?", "До скольки завтрак?", "Где завтрак?", "Завтрак бесплатный?", "Можно позавтракать?", "Время завтрака?", "Завтрак с какого до какого?", "Когда идти на завтрак?", "Завтрак в лобби?", "Самообслуживание?", "Есть утренний завтрак?", "Когда конец завтрака?", "Завтрак где кушать?", "Можно сейчас?", "Утром еда есть?", "Завтрак время скажите", "Когда завтрак дают"],
    "es": ["¿A qué hora es el desayuno?", "Hora del desayuno?", "¿Hay desayuno?", "¿Cuándo es desayuno?", "¿Desde cuándo hasta cuándo?", "¿Dónde es el desayuno?", "¿Es gratis?", "¿Puedo desayunar?", "hora desayuno pls", "¿A qué hora empieza?", "¿A qué hora termina?", "¿Desayuno en lobby?", "¿Es self service?", "¿Hay comida en la mañana?", "¿Cuándo ir a desayunar?", "¿Desayuno incluido?", "¿Dónde comer desayuno?", "¿Se puede ahora?", "¿Desayuno horario?", "¿Qué hora desayuno?"]
  },
  {
    "intent_id": "front_desk_hours",
    "ko": ["프런트 몇시까지 해요?", "직원 항상 있어요?", "프론트 운영 시간?", "직원 언제 있어요?", "프런트 언제 열려요?", "staff 있어요 지금?", "직원 없어요?", "프론트 24시간이에요?", "사람 없으면 어떡해요?", "문의는 어디로?", "직원 언제 만나요?", "프런트 닫았어요?", "staff hours?", "항상 사람이 있나요?", "지금 직원 있어?", "문의 어떻게 해요?", "프런트 몇시부터?", "직원 시간 언제?", "사람 없으면 연락 어떻게?", "직원 어디서 찾아요"],
    "en": ["What are front desk hours?", "Is staff always there?", "Do you have 24h front desk?", "When is front desk open?", "Any staff now?", "No staff?", "What time staff here?", "Front desk hours pls", "Is someone at desk?", "Who can I ask?", "Staff available when?", "Front desk closed?", "Contact how?", "No person here?", "Is there receptionist?", "When staff working?", "How to reach staff?", "Staff now?", "Front desk open time?", "Anyone here?"],
    "zh": ["前台几点有人？", "一直有工作人员吗？", "前台24小时吗？", "什么时候有员工？", "现在有staff吗？", "没有人吗？", "前台时间？", "员工什么时候在？", "没人怎么办？", "怎么联系？", "前台什么时候开？", "现在有人吗？", "员工在哪？", "如何找工作人员？", "前台关闭了吗？", "staff几点在", "联系方法？", "有没有人值班？", "前台开放时间", "现在能找到人吗"],
    "ja": ["フロント何時まで？", "スタッフいついる？", "24時間ですか？", "今スタッフいる？", "人いない？", "フロント時間？", "誰に聞く？", "連絡どうする？", "スタッフいつ来る？", "フロント開いてる？", "受付ありますか？", "スタッフどこ？", "誰もいない？", "連絡方法？", "スタッフ時間？", "今いない？", "いつ対応？", "受付時間教えて", "人いますか？", "フロント対応時間"],
    "ru": ["Во сколько работает ресепшн?", "Есть ли персонал всегда?", "24 часа работает?", "Сейчас есть сотрудник?", "Никого нет?", "Время ресепшн?", "Когда сотрудники?", "Как связаться?", "К кому обратиться?", "Ресепшн открыт?", "Персонал когда?", "Где сотрудники?", "Нет никого?", "Контакт как?", "Когда работает?", "Сейчас есть кто?", "Ресепшн часы", "Связаться с кем?", "Есть администратор?", "Когда можно спросить"],
    "es": ["¿Horario de recepción?", "¿Hay staff siempre?", "¿24 horas recepción?", "¿Hay alguien ahora?", "¿No hay nadie?", "¿A qué hora hay personal?", "hora front desk", "¿Recepción abierta?", "¿Cómo contacto?", "¿A quién pregunto?", "¿Personal cuándo?", "¿Dónde está staff?", "¿Nadie aquí?", "¿Cómo hablar con alguien?", "¿Recepción cuándo?", "¿Hay recepcionista?", "¿Ahora hay staff?", "¿Horario staff?", "¿Contacto cómo?", "¿Alguien aquí?"]
  },
  {
    "intent_id": "check_in_method",
    "ko": ["체크인 어떻게 해요?", "셀프 체크인 방법?", "키오스크로 하는거 맞아요?", "예약번호 어디 넣어요?", "체크인 절차 알려줘", "어떻게 들어가요?", "check in 방법?", "기계로 체크인?", "직원 없이 어떻게 해?", "비밀번호 어디서 확인?", "방번호는 어떻게 알아요?", "키오스크 사용법?", "체크인 과정?", "self checkin 어떻게?", "기계 사용 어려워요", "체크인 순서?", "예약번호 입력 어디?", "체크인 기계 어디?", "비번 어떻게 받아?", "어떻게 시작해요"],
    "en": ["How to check in?", "Self check in how?", "Use kiosk?", "Where enter reservation number?", "Check-in steps?", "How do I get room?", "checkin method?", "No staff how check in?", "Where see password?", "How get room number?", "Kiosk how use?", "Process checkin?", "self checkin pls", "Machine checkin?", "How start checkin?", "Where input code?", "How to open door?", "Check in guide?", "How does it work?", "Kiosk checkin help"],
    "zh": ["怎么入住？", "自助入住怎么做？", "用机器吗？", "预约号哪里输入？", "入住流程？", "怎么拿房间？", "checkin怎么弄？", "没有员工怎么入住？", "密码哪里看？", "房号怎么知道？", "机器怎么用？", "入住步骤？", "自助checkin", "怎么开始？", "在哪输入？", "如何开门？", "入住方法？", "机器入住吗？", "需要做什么？", "流程告诉我"],
    "ja": ["チェックインどうやる？", "セルフチェックイン方法？", "機械使う？", "予約番号どこ入れる？", "手順教えて", "どうやって入る？", "スタッフなしで？", "パスワードどこ？", "部屋番号どうやって？", "キオスク使い方？", "チェックイン流れ？", "self checkin?", "機械でやる？", "どう始める？", "入力どこ？", "ドア開け方？", "方法教えて", "何すればいい？", "チェックイン案内？", "操作方法"],
    "ru": ["Как заселиться?", "Само чек-ин как?", "Через терминал?", "Куда вводить номер?", "Процесс заселения?", "Как получить номер?", "check in как?", "Без персонала как?", "Где пароль?", "Номер комнаты как узнать?", "Как пользоваться киоском?", "Шаги чек-ин?", "Самообслуживание?", "Как начать?", "Где вводить?", "Как открыть дверь?", "Метод заселения?", "Что делать?", "Инструкция?", "Киоск помощь"],
    "es": ["¿Cómo hacer check-in?", "¿Self checkin cómo?", "¿Con máquina?", "¿Dónde pongo número?", "Proceso de entrada?", "¿Cómo obtengo habitación?", "checkin como?", "¿Sin staff cómo?", "¿Dónde ver contraseña?", "¿Cómo saber habitación?", "¿Cómo usar kiosco?", "¿Pasos checkin?", "auto checkin?", "¿Cómo empezar?", "¿Dónde ingresar?", "¿Cómo abrir puerta?", "¿Método entrada?", "¿Qué hacer?", "¿Guía?", "¿Ayuda kiosco?"]
  },
  {
    "intent_id": "early_checkin",
    "ko": ["얼리 체크인 돼요?", "일찍 들어가도 돼?", "3시 전에 가능?", "조금 빨리 체크인?", "짐만 맡길 수 있어요?", "얼리 체크인 안되요?", "미리 들어가고 싶어요", "체크인 전 짐 보관?", "짐 어디 맡겨?", "빨리 입실 가능?", "early checkin 가능?", "짐만 두고 나갈게요", "조금 일찍 가능해?", "방 빨리 받을 수 있어?", "짐 맡기고 나중에 올게요", "몇시 전에 가능?", "지금 들어가도 돼?", "얼리 체크인 방법?", "짐 보관 무료?", "짐 맡길 곳 어디"],
    "en": ["Can I check in early?", "Early check-in possible?", "Before 3 ok?", "Can I enter earlier?", "Can I leave luggage?", "Early checkin no?", "Want early entry", "Luggage before checkin?", "Where store bags?", "Get room early?", "early checkin pls", "Can I drop bags?", "Little early ok?", "Room early possible?", "Leave luggage then come", "Before time ok?", "Can I go in now?", "How early checkin?", "Free luggage storage?", "Where keep luggage"],
    "zh": ["可以提前入住吗？", "能早一点进吗？", "3点前可以吗？", "可以先放行李吗？", "提前入住可以吗？", "不能早入住吗？", "想早点进去", "入住前放行李？", "行李放哪里？", "可以先拿房吗？", "early checkin可以吗", "能寄存行李吗？", "早一点可以吗？", "房间能提前给吗？", "先放行李再回来", "现在可以进去吗？", "提前入住怎么做？", "行李免费吗？", "哪里放行李", "可以先寄存吗"],
    "ja": ["アーリーチェックインできる？", "早く入れる？", "3時前OK？", "荷物預けられる？", "早めに入りたい", "早いチェックイン無理？", "先に荷物だけ？", "チェックイン前荷物？", "どこに置く？", "部屋早くもらえる？", "early checkin?", "荷物預けて後で来る", "少し早くOK？", "今入れる？", "方法ある？", "無料？", "荷物場所どこ", "早め入室可能？", "できる？", "どうする？"],
    "ru": ["Можно ранний заезд?", "Рано можно заселиться?", "До 3 можно?", "Можно оставить багаж?", "Ранний чек-ин?", "Нельзя раньше?", "Хочу раньше", "До заселения багаж?", "Где оставить?", "Можно раньше номер?", "early checkin?", "Оставлю вещи", "Немного раньше?", "Сейчас можно?", "Как сделать?", "Бесплатно хранить?", "Где багаж?", "Можно войти раньше?", "Есть вариант?", "Рано заселение"],
    "es": ["¿Early check-in?", "¿Puedo entrar antes?", "¿Antes de las 3?", "¿Puedo dejar equipaje?", "¿Entrada temprana?", "¿No se puede antes?", "Quiero entrar temprano", "¿Equipaje antes?", "¿Dónde dejar maletas?", "¿Habitación antes?", "early checkin posible?", "Dejo maleta y vuelvo", "¿Un poco antes?", "¿Puedo entrar ahora?", "¿Cómo hacerlo?", "¿Gratis guardar?", "¿Dónde equipaje?", "¿Entrada anticipada?", "¿Hay opción?", "¿Temprano?"]
  },
  {
    "intent_id": "check_out_method",
    "ko": ["체크아웃 어떻게 해요?", "퇴실 절차 뭐야?", "슬리퍼 반납하면 끝?", "체크아웃 방법 알려줘", "그냥 나가면 돼요?", "체크아웃 뭐 해야 돼?", "check out 방법?", "슬리퍼 어디에?", "직원 확인 필요?", "퇴실 어떻게 완료?", "아무것도 안해도 돼?", "절차 없어요?", "슬리퍼만 주면 돼?", "체크아웃 간단해?", "어디에 반납?", "퇴실 순서?", "체크아웃 과정?", "그냥 가도 돼?", "체크아웃 안내", "뭐 제출해요"],
    "en": ["How to check out?", "Checkout steps?", "Just return slippers?", "What to do for checkout?", "Can I just leave?", "checkout method?", "Where return slippers?", "Need staff?", "How finish checkout?", "Nothing to do?", "No process?", "Just give slippers?", "Is it simple?", "Where return?", "Steps checkout?", "Process checkout?", "Can I go?", "Checkout guide?", "Do I submit anything?", "Finish how"],
    "zh": ["怎么退房？", "退房流程？", "还拖鞋就可以吗？", "需要做什么？", "可以直接走吗？", "checkout方法？", "拖鞋放哪里？", "需要员工吗？", "怎么完成退房？", "不用做别的吗？", "没有流程吗？", "只要还拖鞋？", "很简单吗？", "在哪里还？", "退房步骤？", "流程是什么？", "可以直接离开？", "退房说明", "需要交东西吗", "怎么结束"],
    "ja": ["チェックアウトどうする？", "退室手順？", "スリッパ返すだけ？", "何すればいい？", "そのまま出ていい？", "checkout方法？", "スリッパどこ？", "スタッフ必要？", "どう完了？", "何もいらない？", "手続きなし？", "スリッパだけ？", "簡単？", "どこ返す？", "手順教えて", "流れは？", "そのまま帰る？", "案内ある？", "何か出す？", "終わり方"],
    "ru": ["Как выехать?", "Процесс выезда?", "Только тапочки вернуть?", "Что делать?", "Можно просто уйти?", "checkout как?", "Куда тапочки?", "Нужен персонал?", "Как завершить?", "Ничего не нужно?", "Нет процесса?", "Только вернуть?", "Просто?", "Куда сдавать?", "Шаги?", "Процедура?", "Можно уйти?", "Инструкция?", "Что сдавать?", "Как закончить"],
    "es": ["¿Cómo hacer check-out?", "¿Proceso de salida?", "¿Solo devolver pantuflas?", "¿Qué hacer?", "¿Puedo irme directo?", "checkout como?", "¿Dónde dejar pantuflas?", "¿Necesito staff?", "¿Cómo terminar?", "¿Nada más?", "¿Sin proceso?", "¿Solo devolver?", "¿Es fácil?", "¿Dónde dejar?", "¿Pasos?", "¿Procedimiento?", "¿Puedo salir?", "¿Guía?", "¿Entrego algo?", "¿Cómo finalizar?"]
  },
  {
    "intent_id": "reservation_search",
    "ko": ["예약 조회 어떻게 해요?", "예약번호 안돼요", "이름으로 찾을 수 있어?", "예약 검색 안됨", "오늘 예약인데 안 보여요", "예약 확인 어떻게?", "번호 잃어버렸어요", "예약 조회 부탁", "예약 안떠요", "이름 검색 가능?", "당일 예약 왜 안됨?", "예약 찾기 어디?", "예약 확인 안돼요", "search reservation?", "예약번호 오류", "예약 안나와요", "이름으로 조회해줘", "예약 확인 방법?", "지금 예약 확인 가능?", "왜 안보여요"],
    "en": ["How to find reservation?", "Reservation number not working", "Can search by name?", "Reservation not found", "Booked today not showing", "How check booking?", "Lost booking number", "Find my reservation", "Booking not showing", "Search by name?", "Why today booking not appear?", "Where search?", "Cannot find booking", "search reservation pls", "Error booking number", "No booking found", "Find by name please", "How verify booking?", "Can check now?", "Why not show"],
    "zh": ["怎么查预约？", "预约号不行", "可以用名字查吗？", "找不到预约", "今天预订没显示", "怎么确认预订？", "号码丢了", "帮我查预约", "没有显示", "可以用名字吗？", "为什么今天看不到？", "哪里查？", "查不到", "search reservation", "号码错误", "没有记录", "用名字查一下", "怎么确认？", "现在可以查吗？", "为什么没有"],
    "ja": ["予約どうやって確認？", "番号使えない", "名前で探せる？", "予約出てこない", "今日の予約見えない", "確認方法？", "番号なくした", "予約探して", "表示されない", "名前検索できる？", "なぜ見えない？", "どこで？", "見つからない", "search reservation?", "番号エラー", "予約ない？", "名前でお願い", "確認どうする？", "今確認できる？", "なんで出ない"],
    "ru": ["Как найти бронь?", "Номер не работает", "Можно по имени?", "Бронь не найдена", "Сегодняшняя не видна", "Как проверить?", "Потерял номер", "Найти бронь", "Не отображается", "По имени можно?", "Почему не видно?", "Где искать?", "Не могу найти", "search reservation", "Ошибка номера", "Нет записи", "По имени пожалуйста", "Как подтвердить?", "Сейчас можно?", "Почему нет"],
    "es": ["¿Cómo buscar reserva?", "Número no funciona", "¿Por nombre?", "No aparece reserva", "Hoy no se ve", "¿Cómo confirmar?", "Perdí número", "Buscar mi reserva", "No sale", "¿Se puede por nombre?", "¿Por qué no aparece?", "¿Dónde buscar?", "No encuentro", "search reservation", "Error número", "No hay reserva", "Buscar por nombre", "¿Cómo verificar?", "¿Se puede ahora?", "¿Por qué no sale?"]
  },
  {
    "intent_id": "reservation_extend",
    "ko": ["숙박 연장 가능해요?", "하루 더 묵고 싶어요", "연장 어떻게 해요?", "같은 방 계속 가능?", "같은 침대 유지돼?", "예약 연장 부탁", "더 있고 싶어요", "연장 방법 알려줘", "online으로 해야돼?", "연장 비용?", "하루 추가 가능?", "연장 바로 돼?", "지금 연장 가능?", "같은 방타입 유지?", "extend stay?", "더 예약 가능?", "침대 바뀌나요?", "연장 어디서?", "연장 신청", "며칠 더 가능?"],
    "en": ["Can I extend stay?", "Stay one more night", "How extend booking?", "Same room possible?", "Keep same bed?", "Extend reservation pls", "Want to stay longer", "How to extend?", "Do online?", "Extend cost?", "Add one night?", "Can extend now?", "Same room type?", "extend stay?", "More booking?", "Bed change?", "Where extend?", "Extend request", "Few more days?", "Can I add nights"],
    "zh": ["可以延住吗？", "想多住一天", "怎么延长？", "还能住同一个房间吗？", "同一床可以吗？", "帮我延长", "想多待几天", "延长方法？", "要网上吗？", "费用多少？", "加一天可以吗？", "现在能延吗？", "同房型可以吗？", "extend stay?", "还能订吗？", "床会变吗？", "哪里延长？", "申请延长", "可以多几天？", "增加晚数"],
    "ja": ["延泊できますか？", "もう一泊したい", "延長方法？", "同じ部屋OK？", "同じベッド？", "延長お願い", "もっと泊まりたい", "どう延長？", "オンライン？", "料金いくら？", "一泊追加？", "今できる？", "同タイプ？", "extend stay?", "まだ予約？", "ベッド変わる？", "どこで？", "延長申請", "何日追加？", "泊数増やす"],
    "ru": ["Можно продлить?", "Еще ночь хочу", "Как продлить?", "Тот же номер?", "Та же кровать?", "Продлить бронь", "Хочу остаться", "Метод продления?", "Онлайн нужно?", "Цена?", "Добавить ночь?", "Можно сейчас?", "Тот же тип?", "extend stay?", "Еще забронировать?", "Кровать сменится?", "Где продлить?", "Запрос продления", "Еще дни?", "Добавить ночи"],
    "es": ["¿Puedo extender?", "Quiero una noche más", "¿Cómo extender?", "¿Misma habitación?", "¿Misma cama?", "Extender reserva", "Quiero quedarme más", "¿Método?", "¿Online?", "¿Costo?", "¿Agregar noche?", "¿Ahora se puede?", "¿Mismo tipo?", "extend stay?", "¿Más reserva?", "¿Cambia cama?", "¿Dónde extender?", "Solicitud extensión", "¿Más días?", "Agregar noches"]
  },
  {
    "intent_id": "reservation_change",
    "ko": ["예약 변경 어떻게 해요?", "날짜 바꾸고 싶어요", "방 타입 변경 가능?", "예약 수정 부탁", "예약 변경 어디서?", "사이트 통해야 해요?", "변경 안돼요?", "예약 바꾸고 싶어", "변경 방법 알려줘", "날짜 수정 가능?", "객실 바꿀 수 있어?", "예약 수정 안됨", "change reservation?", "예약 변경 직접 해?", "어디 연락해?", "예약 수정 절차?", "변경 수수료?", "예약 바꾸기", "변경 요청", "예약 수정 어디"],
    "en": ["How to change reservation?", "Change dates?", "Change room type?", "Modify booking pls", "Where change?", "Need contact site?", "Cannot change?", "Want to modify", "How change?", "Edit booking?", "Can change room?", "Cannot edit", "change reservation?", "Do myself?", "Contact where?", "Process?", "Fee?", "Modify booking", "Change request", "Where edit"],
    "zh": ["怎么改预约？", "想改日期", "可以改房型吗？", "修改预订", "在哪里改？", "要联系网站吗？", "不能改吗？", "想修改", "方法？", "可以改吗？", "房间能换？", "改不了", "change reservation?", "要自己改？", "联系哪里？", "流程？", "费用？", "修改预订", "申请修改", "哪里改"],
    "ja": ["予約変更どうする？", "日付変えたい", "部屋タイプ変更？", "予約修正", "どこで？", "サイト連絡？", "変更できない？", "変えたい", "方法？", "編集できる？", "部屋変えれる？", "無理？", "change reservation?", "自分で？", "どこ連絡？", "手順？", "料金？", "予約変更", "変更申請", "どこで変更"],
    "ru": ["Как изменить бронь?", "Дату поменять", "Тип номера?", "Изменить бронирование", "Где менять?", "Через сайт?", "Нельзя изменить?", "Хочу изменить", "Как сделать?", "Редактировать?", "Сменить номер?", "Не получается", "change reservation?", "Самому?", "Куда писать?", "Процесс?", "Комиссия?", "Изменить бронь", "Запрос", "Где изменить"],
    "es": ["¿Cómo cambiar reserva?", "Cambiar fechas?", "Cambiar habitación?", "Modificar reserva", "¿Dónde cambiar?", "¿Contactar web?", "¿No se puede?", "Quiero cambiar", "¿Cómo hacerlo?", "Editar reserva?", "¿Cambiar cuarto?", "No deja", "change reservation?", "¿Yo mismo?", "¿Dónde contacto?", "¿Proceso?", "¿Costo?", "Modificar", "Solicitud cambio", "¿Dónde editar?"]
  }
];

// ── 삽입 로직 ────────────────────────────────────────────────────

const LANGS = ['ko', 'en', 'zh', 'ja', 'ru', 'es'];

async function run() {
  // 전체 rows 생성
  const rows = [];
  for (const item of DATA) {
    for (const lang of LANGS) {
      const questions = item[lang] || [];
      for (const q of questions) {
        rows.push({ intent_id: item.intent_id, language: lang, question_text: q });
      }
    }
  }

  console.log(`[bulk_insert] 총 ${rows.length}개 행 준비`);

  // 인텐트별 기존 질문 조회 후 중복 제거
  const intentIds = [...new Set(DATA.map(d => d.intent_id))];
  const { data: existing } = await supabase
    .from('intent_questions')
    .select('intent_id, question_text')
    .in('intent_id', intentIds);

  const existingSet = new Set((existing || []).map(r => `${r.intent_id}::${r.question_text}`));
  console.log(`[bulk_insert] 기존 질문 수: ${existingSet.size}개`);

  const newRows = rows.filter(r => !existingSet.has(`${r.intent_id}::${r.question_text}`));
  console.log(`[bulk_insert] 신규 삽입 대상: ${newRows.length}개`);

  if (newRows.length === 0) {
    console.log('[bulk_insert] 추가할 질문 없음.');
    process.exit(0);
  }

  // 배치 삽입
  const BATCH = 100;
  let total = 0;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    const { error } = await supabase.from('intent_questions').insert(batch);
    if (error) {
      console.error(`[ERROR] 배치 ${i}~${i+BATCH}:`, error.message);
    } else {
      total += batch.length;
      process.stdout.write(`\r[bulk_insert] 삽입 중... ${total}/${newRows.length}`);
    }
  }

  console.log(`\n[bulk_insert] 완료! ${total}개 삽입됨`);

  // 인텐트별 통계
  const stats = {};
  for (const r of newRows) {
    stats[r.intent_id] = (stats[r.intent_id] || 0) + 1;
  }
  console.log('\n인텐트별 삽입 수:');
  Object.entries(stats).forEach(([id, n]) => console.log(`  ${id}: ${n}개`));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
