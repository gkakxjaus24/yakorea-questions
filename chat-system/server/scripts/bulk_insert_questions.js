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
