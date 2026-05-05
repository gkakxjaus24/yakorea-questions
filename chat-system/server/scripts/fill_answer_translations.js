// 모든 intent에 6개 언어(ko/en/zh/ja/ru/es) 답변 채우기
// 이미 있는 언어는 건너뜀 (upsert)
require('dotenv').config();
const supabase = require('../src/services/supabase');

// {{변수}}는 그대로 유지 — 서버에서 settings로 치환됨
const T = {
  aircon_usage: {
    // 이미 6개 언어 모두 있음 — 스킵
  },
  bed_change: {
    en: 'Bed number changes are not allowed on check-in day. Staff will advise on available change dates. Please vacate your current bed by 11:00 AM and move to the new bed after 3:00 PM on the change day.',
    zh: '入住当天不能更换床位号。员工会告知可更换的日期。更换当天请在上午11点前腾空原床位,下午3点后移至新床位。',
    ja: 'チェックイン当日のベッド番号変更はできません。変更可能な日はスタッフがご案内します。変更当日は午前11時までに元のベッドを空け、午後3時以降に新しいベッドへ移動してください。',
    ru: 'Смена номера кровати невозможна в день заезда. Сотрудник сообщит доступные даты. В день смены освободите прежнюю кровать до 11:00 и переходите на новую после 15:00.',
    es: 'No se puede cambiar el número de cama el día de entrada. El personal informará las fechas disponibles. Desocupe la cama anterior antes de las 11:00 y pase a la nueva después de las 15:00.',
  },
  bed_issue: {
    en: 'If someone or something is on your bed, you may have the wrong bed number. Staff needs to verify. Please type "Talk to person" in the message box at the bottom right.',
    zh: '如果您的床位上有他人或物品,可能是床位号弄错了。需要员工确认。请在右下角消息框输入 "Talk to person"。',
    ja: '自分のベッドに他の人や荷物がある場合、ベッド番号を間違えている可能性があります。スタッフによる確認が必要です。画面右下のメッセージ欄に「Talk to person」と入力してください。',
    ru: 'Если на вашей кровати кто-то или чьи-то вещи, возможно, вы перепутали номер кровати. Требуется проверка сотрудником. Введите "Talk to person" в окне сообщений справа внизу.',
    es: 'Si hay otra persona u objeto en su cama, puede haber confundido el número. Se requiere verificación del personal. Escriba "Talk to person" en el cuadro de mensajes abajo a la derecha.',
  },
  bed_keep: {
    en: 'If you extended your stay with the same name and same room type, you can keep using the same bed without removing your luggage.',
    zh: '如果您以相同姓名、相同房型续订,可以不搬行李继续使用同一张床。',
    ja: '同じ名前・同じ部屋タイプで延泊予約された場合、荷物を移動せずに同じベッドをそのままご利用いただけます。',
    ru: 'Если вы продлили проживание под тем же именем и в том же типе номера, вы можете оставаться на той же кровати без переноса вещей.',
    es: 'Si ha extendido su estancia con el mismo nombre y mismo tipo de habitación, puede seguir usando la misma cama sin mover su equipaje.',
  },
  breakfast_door: {
    en: 'If the breakfast room door is locked or the key box does not open, please use the spare key located under the keyboard.',
    zh: '如果早餐区门锁住或密码盒打不开,请使用键盘下方的备用钥匙。',
    ja: '朝食スペースのドアが施錠されているか、キーボックスが開かない場合は、キーボードの下にある予備の鍵をご利用ください。',
    ru: 'Если дверь зала для завтрака заперта или ключница не открывается, используйте запасной ключ под клавиатурой.',
    es: 'Si la puerta del área de desayuno está cerrada o la caja de llaves no abre, use la llave de repuesto que está debajo del teclado.',
  },
  breakfast_info: {
    ru: 'Время завтрака — {{breakfast_time}}, самообслуживание в лобби (кухня) на 1 этаже.',
    es: 'El desayuno es de {{breakfast_time}}, autoservicio en el lobby (cocina) de la planta 1.',
  },
  building_access: {
    en: 'The entrance is open 24 hours and common areas are available 24/7. Please keep quiet after 11 PM and in the early morning.',
    zh: '大门24小时开放,公共区域也24小时可用。但晚上11点后和清晨请保持安静。',
    ja: '出入口は24時間開いており、共用スペースも24時間利用可能です。ただし夜11時以降と早朝は静かにお願いします。',
    ru: 'Вход открыт круглосуточно, общие зоны доступны 24/7. После 23:00 и ранним утром соблюдайте тишину.',
    es: 'La entrada está abierta 24 horas y las áreas comunes están disponibles 24/7. Mantenga silencio después de las 23:00 y temprano en la mañana.',
  },
  check_in_time: {
    ru: 'Заезд возможен с {{check_in_time}}. Работает самостоятельная регистрация.',
    es: 'El check-in está disponible desde las {{check_in_time}}. Funciona con auto-check-in.',
  },
  check_out_method: {
    en: 'Return your slippers to complete check-out. No other procedure is needed. After check-out, you may store your luggage in front of the counter.',
    zh: '归还拖鞋即完成退房,无需其他手续。退房后行李可存放在前台前。',
    ja: 'スリッパを返却すればチェックアウト完了です。その他の手続きはありません。チェックアウト後、荷物はカウンター前に保管可能です。',
    ru: 'Для выезда верните тапочки — другая процедура не требуется. После выезда можно оставить багаж у стойки.',
    es: 'Devuelva las zapatillas para completar la salida. No hay otro trámite. Tras el check-out puede dejar el equipaje frente al mostrador.',
  },
  check_out_time: {
    ru: 'Выезд до {{check_out_time}}. Верните тапочки — выезд завершён, другая процедура не требуется.',
    es: 'El check-out es hasta las {{check_out_time}}. Devuelva las zapatillas para completar la salida; no hay otro trámite.',
  },
  contact_info: {
    ru: 'Контакт: {{contact_phone}}',
    es: 'Contacto: {{contact_phone}}',
  },
  early_checkin: {
    en: 'Early check-in is not available. You may store your luggage in front of the counter before check-in.',
    zh: '不提供提前入住。入住前可将行李存放在前台前。',
    ja: 'アーリーチェックインはできません。チェックイン前の荷物はカウンター前に保管いただけます。',
    ru: 'Ранний заезд невозможен. До заезда можно оставить багаж у стойки.',
    es: 'No se permite el check-in anticipado. Antes del check-in puede dejar el equipaje frente al mostrador.',
  },
  fridge_rule: {
    en: 'Food in the fridge without a check-out date label is free for anyone to eat. Please label your own food with your check-out date.',
    zh: '冰箱里没有标注退房日期的食物任何人都可以食用。请在自己的食物上标明退房日期。',
    ja: '冷蔵庫内でチェックアウト日が書かれていない食品は誰でも食べられます。自分の食品には必ずチェックアウト日を書いてください。',
    ru: 'Еду в холодильнике без отметки даты выезда может съесть любой. Подписывайте свою еду с датой выезда.',
    es: 'La comida en el refrigerador sin fecha de salida puede ser comida por cualquiera. Etiquete su comida con su fecha de check-out.',
  },
  front_desk_hours: {
    ru: 'Отель работает без постоянного персонала на стойке. Для вопросов свяжитесь с сотрудником через окно сообщений справа внизу.',
    es: 'Funcionamos sin personal permanente en recepción. Para consultas, contacte al personal desde el cuadro de mensajes abajo a la derecha.',
  },
  heavy_luggage: {
    en: 'Sorry, we do not assist with carrying heavy luggage. You must move your luggage yourself. A portable scale is available on the table in front of the counter for weight checks.',
    zh: '抱歉,我们不提供搬运重行李的帮助,需您自行搬运。前台前的桌子上有便携秤可用于称重。',
    ja: '申し訳ありませんが、重い荷物の運搬サポートはご提供しておりません。荷物はご自身で移動していただく必要があります。カウンター前のテーブルに携帯用の秤がありますので、重量確認は可能です。',
    ru: 'К сожалению, мы не помогаем с переноской тяжёлого багажа — его нужно нести самостоятельно. На столе у стойки есть переносные весы для проверки веса.',
    es: 'Lo sentimos, no ayudamos a cargar equipaje pesado; debe moverlo usted mismo. En la mesa frente al mostrador hay una báscula portátil para pesar.',
  },
  kitchen_info: {
    en: 'The microwave is under the kitchen table. For drinking water, please use the water purifier on the kitchen table. For hot water, use the electric kettle.',
    zh: '微波炉在厨房桌子下方。饮用水请使用厨房桌上的净水器。热水请使用电热水壶。',
    ja: '電子レンジはキッチンテーブルの下にあります。飲み水はキッチンテーブル上の浄水器をご利用ください。お湯は電気ケトルをお使いください。',
    ru: 'Микроволновка — под кухонным столом. Питьевая вода — в фильтре на кухонном столе. Горячую воду кипятите в электрочайнике.',
    es: 'El microondas está debajo de la mesa de la cocina. Para agua potable use el purificador sobre la mesa. Para agua caliente use la tetera eléctrica.',
  },
  laundry_info: {
    en: 'Laundry costs {{laundry_price}}, cash only. This includes both washing and drying. Put the cash and laundry in a laundry bag beside the counter — staff will process it within 24 hours.',
    zh: '洗衣费用为 {{laundry_price}},仅收现金。费用包含洗涤+烘干。将现金和衣物放入洗衣袋中,置于前台旁边,员工将在24小时内处理完成。',
    ja: '洗濯料金は {{laundry_price}} で、現金のみ対応です。洗濯と乾燥が含まれます。現金と洗濯物を洗濯袋に入れてカウンター横に置いてください。スタッフが24時間以内に処理します。',
    ru: 'Стирка стоит {{laundry_price}}, только наличными. Включает стирку и сушку. Положите деньги и бельё в мешок для стирки рядом со стойкой — персонал обработает в течение 24 часов.',
    es: 'La lavandería cuesta {{laundry_price}}, solo en efectivo. Incluye lavado y secado. Coloque el efectivo y la ropa en una bolsa de lavandería junto al mostrador; el personal lo procesará en 24 horas.',
  },
  laundry_payment: {
    en: 'Laundry payment is cash only. Cards, bank transfers, etc. are not accepted. Please put 5,000 KRW with your laundry in a laundry bag beside the counter.',
    zh: '洗衣费仅收现金,不接受刷卡、转账等。请将5,000韩元和衣物一起放入洗衣袋,置于前台旁边。',
    ja: '洗濯料金は現金のみです。カード・銀行振込などはご利用いただけません。5,000ウォンを洗濯物と一緒に洗濯袋に入れてカウンター横に置いてください。',
    ru: 'Оплата стирки — только наличными. Карты, переводы не принимаются. Положите 5,000 вон вместе с бельём в мешок для стирки рядом со стойкой.',
    es: 'El pago de la lavandería es solo en efectivo. No se aceptan tarjetas ni transferencias. Coloque 5.000 KRW con su ropa en una bolsa de lavandería junto al mostrador.',
  },
  locker_help: {
    en: 'Press the 4-digit number from top to bottom, then turn the handle to the left to open. Guests cannot change the locker password themselves.',
    zh: '请按照从上到下的顺序输入4位数字,然后将把手向左转打开。储物柜密码不可由客人自行更改。',
    ja: '4桁の番号を上から下の順に押し、ハンドルを左に回して開けてください。ロッカーの暗証番号はお客様ご自身では変更できません。',
    ru: 'Нажимайте 4 цифры сверху вниз, затем поверните ручку влево. Пароль шкафчика гость изменить не может.',
    es: 'Pulse los 4 dígitos de arriba a abajo y gire la manija a la izquierda para abrir. La contraseña del casillero no puede cambiarla el huésped.',
  },
  lost_found: {
    en: 'For lost items, please tell us the name, size, shape, color, date, time, and location. We can check CCTV. Dormitory rooms have personal lockers, so we are not responsible for items lost inside the room.',
    zh: '遗失物品请告知物品名称、大小、形状、颜色、遗失日期、时间、地点。可查看监控。多人间每位客人都有个人储物柜,房间内遗失物品不另承担责任。',
    ja: '忘れ物のお問い合わせの際は、物のお名前、大きさ、形、色、紛失日、時間、場所をお知らせください。CCTVの確認が可能です。ドミトリー客室は個人ロッカーがございますので、客室内の紛失物については別途責任を負いかねます。',
    ru: 'При запросе о потерянных вещах сообщите: название, размер, форму, цвет, дату, время и место. Можем проверить записи камер. В дормиториях есть личные шкафчики, поэтому за вещи, потерянные в номере, отель ответственности не несёт.',
    es: 'Para objetos perdidos, indique nombre, tamaño, forma, color, fecha, hora y lugar. Podemos revisar las cámaras. Los dormitorios tienen casilleros personales, por lo que no nos responsabilizamos por objetos perdidos dentro de la habitación.',
  },
  luggage_scale: {
    en: 'A portable scale is on the table in front of the counter — feel free to use it. We cannot help carry heavy luggage.',
    zh: '前台前的桌子上有便携秤,可自由使用。无法帮助搬运重行李。',
    ja: 'カウンター前のテーブルに携帯用の秤がありますので、ご自由にお使いください。重い荷物の運搬サポートは難しいです。',
    ru: 'На столе у стойки есть переносные весы — пользуйтесь свободно. Помочь с переноской тяжёлого багажа мы не можем.',
    es: 'En la mesa frente al mostrador hay una báscula portátil; úsela libremente. No podemos ayudar a cargar equipaje pesado.',
  },
  luggage_storage: {
    en: 'Luggage can be stored in front of the counter. Long-term storage is free for up to {{long_storage_free_days}}; after that, {{long_storage_daily_fee}} per day. For long-term storage, label with your name, phone, check-out date, and return date.',
    zh: '行李可存放在前台前。长期寄存最多 {{long_storage_free_days}} 免费,超出部分每天 {{long_storage_daily_fee}}。长期寄存请标注姓名、联系方式、退房日期和回来日期。',
    ja: '荷物はカウンター前に保管できます。長期保管は最大 {{long_storage_free_days}} 無料、超過分は1日 {{long_storage_daily_fee}} です。長期保管の際はお名前、連絡先、チェックアウト日、戻る日をご記入ください。',
    ru: 'Багаж можно оставить у стойки. Длительное хранение бесплатно до {{long_storage_free_days}}, далее {{long_storage_daily_fee}} в день. Для длительного хранения укажите имя, телефон, дату выезда и дату возврата.',
    es: 'El equipaje puede guardarse frente al mostrador. Almacenamiento prolongado gratis hasta {{long_storage_free_days}}; después, {{long_storage_daily_fee}} por día. Indique nombre, contacto, fecha de salida y fecha de regreso.',
  },
  mixed_dorm: {
    en: 'The basement 10-bed dormitory is a mixed-gender room. If you mistakenly booked a male-only / female-only room, please re-check your reservation details. To switch to a different-gender room, check availability on the booking site; cancellation fees may apply if it is not our error.',
    zh: '地下10人间为男女混宿。若误订了男性专用/女性专用房间,请再次核对预订详情。换到另一性别房间需在预订网站上自行查看空房,若非我方失误,可能产生取消手续费。',
    ja: '地下の10人部屋は男女混合ドミトリーです。男性専用/女性専用客室を誤って予約された場合は予約詳細を再度ご確認ください。別の性別の客室へ移るには予約サイトで空きをご確認いただく必要があり、当方の手違いでない場合はキャンセル手数料が発生する場合があります。',
    ru: 'Подвальный 10-местный номер — смешанный (муж./жен.). Если вы ошибочно забронировали мужской/женский, проверьте детали бронирования. Для смены на номер другого пола нужно самостоятельно проверить наличие мест на сайте; если это не наша ошибка, может взиматься штраф.',
    es: 'El dormitorio del sótano para 10 personas es mixto. Si reservó por error uno masculino/femenino, revise los detalles de su reserva. Para cambiar a una habitación de otro género debe verificar disponibilidad en la plataforma; si no es error nuestro, pueden aplicarse cargos de cancelación.',
  },
  no_public_restroom: {
    en: 'There is no separate shared restroom. Please use the restroom inside each room.',
    zh: '没有单独的公共卫生间。请使用各房间内的卫生间。',
    ja: '別途の共用トイレはございません。各客室内のトイレをご利用ください。',
    ru: 'Отдельного общего туалета нет. Пользуйтесь туалетом внутри каждого номера.',
    es: 'No hay baño compartido separado. Use el baño dentro de cada habitación.',
  },
  noise_complaint: {
    en: 'Noise issues need to be checked directly by staff. Please type "Talk to person" in the message box at the bottom right to connect with staff.',
    zh: '噪音问题需要员工直接处理。请在右下角消息框输入 "Talk to person" 联系员工。',
    ja: '騒音問題はスタッフが直接確認する必要があります。画面右下のメッセージ欄に「Talk to person」と入力してスタッフにつないでください。',
    ru: 'Проблемы с шумом должен проверять сотрудник. Введите "Talk to person" в окне сообщений справа внизу, чтобы связаться с персоналом.',
    es: 'Los problemas de ruido requieren verificación directa del personal. Escriba "Talk to person" en el cuadro de mensajes abajo a la derecha para conectar.',
  },
  parking_info: {
    en: 'Only 1 parking space is available, and advance reservation is required. Please text {{parking_phone}} to reserve.',
    zh: '仅有1个停车位,必须提前预订。请发短信至 {{parking_phone}} 预约。',
    ja: '駐車スペースは1台のみで、事前予約が必須です。{{parking_phone}} へショートメッセージをお送りください。',
    ru: 'Парковочное место только одно, обязательна предварительная бронь. Отправьте SMS на {{parking_phone}}.',
    es: 'Solo hay 1 plaza de parking y se requiere reserva previa. Envíe un SMS a {{parking_phone}} para reservar.',
  },
  password_change: {
    en: 'Room passwords cannot be changed immediately. If needed, please ask staff — it can be changed the next morning.',
    zh: '房间密码无法立即更改。如有需要请联系员工,第二天上午可以更改。',
    ja: 'お部屋のパスワードを即時変更することはできません。必要な場合はスタッフにご依頼ください。翌日の午前中に変更可能です。',
    ru: 'Мгновенно сменить пароль номера нельзя. При необходимости обратитесь к сотруднику — смена возможна на следующее утро.',
    es: 'La contraseña de la habitación no se puede cambiar de inmediato. Si lo necesita, pida al personal: podrá cambiarse a la mañana siguiente.',
  },
  payment_onsite: {
    en: 'On-site payment is not available. Neither cash nor card can be used on site — reservations are online only.',
    zh: '不接受现场付款。现金、刷卡均不可现场支付,仅支持线上预订。',
    ja: '現地でのお支払いはできません。現金・カードいずれも現地払い不可で、オンラインでのみ予約可能です。',
    ru: 'Оплата на месте невозможна. Ни наличными, ни картой на месте оплатить нельзя — бронирование только онлайн.',
    es: 'No se permite el pago en el lugar. Ni efectivo ni tarjeta son aceptados on-site; solo reserva online.',
  },
  printer_info: {
    en: 'To print, send your file to {{print_email}} then send a print request message. Subject: Print request. Include your name and room number. Output within 1 hour. Free limits: B&W up to {{free_print_bw}}, color up to {{free_print_color}}. Photos/images and double-sided printing are not supported.',
    zh: '需要打印时,请将文件发送至 {{print_email}},然后在消息窗口发送打印请求消息。主题:Print request,并写明姓名和房号。1小时内完成打印。免费额度:黑白 {{free_print_bw}},彩色 {{free_print_color}}。不支持照片/图像及双面打印。',
    ja: 'プリントをご希望の場合は {{print_email}} へファイルを送信後、メッセージ欄からプリント依頼メッセージをお送りください。件名:Print request、お名前と部屋番号を併記してください。1時間以内に出力されます。無料出力はモノクロ {{free_print_bw}}、カラー {{free_print_color}} までです。写真/画像および両面印刷はできません。',
    ru: 'Для печати отправьте файл на {{print_email}}, затем напишите в чат запрос на печать. Тема: Print request, укажите имя и номер комнаты. Распечатка в течение 1 часа. Бесплатно: ч/б до {{free_print_bw}}, цветные до {{free_print_color}}. Фото/изображения и двусторонняя печать недоступны.',
    es: 'Para imprimir, envíe el archivo a {{print_email}} y luego envíe un mensaje de solicitud. Asunto: Print request, con su nombre y número de habitación. Impresión en 1 hora. Gratis: B/N hasta {{free_print_bw}}, color hasta {{free_print_color}}. No se admiten fotos/imágenes ni impresión a doble cara.',
  },
  projector_ott: {
    en: 'The projector is operated with the black remote. If the remote is missing from the OTT room, please contact staff. OTT services are used by logging in with your own personal account.',
    zh: '投影仪用黑色遥控器操作。如 OTT 房间没有遥控器请联系员工。OTT 服务请使用各自的个人账号登录使用。',
    ja: 'プロジェクターは黒のリモコンで操作します。OTTルームにリモコンがない場合はスタッフにご連絡ください。OTTサービスは各自個人アカウントでログインしてご利用ください。',
    ru: 'Проектором управляют чёрным пультом. Если в OTT-комнате нет пульта, сообщите сотруднику. OTT-сервисы используются входом под своей личной учётной записью.',
    es: 'El proyector se opera con el control remoto negro. Si falta el control en la sala OTT, contacte al personal. Los servicios OTT se usan iniciando sesión con su cuenta personal.',
  },
  refund_policy: {
    en: 'Refunds follow the refund/cancellation policy of the booking site you used. Whether a personal schedule change is refundable is also decided by the booking site policy.',
    zh: '退款依照您预订所用平台的退款/取消规定。因个人行程变更是否可退款也由预订平台政策决定。',
    ja: '返金は予約されたサイトの返金/キャンセル規定に従います。個人のご都合による変更で返金可能かどうかも予約サイトのポリシーに基づいて判断されます。',
    ru: 'Возврат средств — по правилам сайта, на котором вы бронировали. Возможность возврата при изменении личного графика также определяется правилами сайта бронирования.',
    es: 'Los reembolsos siguen la política de reembolso/cancelación de la plataforma donde reservó. La posibilidad de reembolso por cambios personales también depende de esa política.',
  },
  reservation_change: {
    en: 'Reservation changes must be made directly through the customer service of the booking site you used.',
    zh: '预订变更请通过您预订所用平台的客服直接办理。',
    ja: '予約の変更は、ご予約いただいたサイトのカスタマーサービスから直接お手続きください。',
    ru: 'Изменения в бронировании производятся напрямую через службу поддержки сайта, где вы бронировали.',
    es: 'Los cambios de reserva deben gestionarse directamente con el servicio al cliente de la plataforma donde reservó.',
  },
  reservation_extend: {
    en: 'To extend your stay, please book again online. If you book an extension under the same room type, you can keep using the same bed or same room.',
    zh: '延长住宿请在线重新预订。如以相同房型续订,可继续使用同一张床或同一房间。',
    ja: '延泊はオンラインで再度ご予約ください。同じ部屋タイプで延泊予約いただければ、同じベッドまたは同じお部屋を継続してご利用いただけます。',
    ru: 'Продление проживания оформляется повторным бронированием онлайн. Если бронируете тот же тип номера, сможете остаться на той же кровати или в той же комнате.',
    es: 'Para extender la estancia, reserve nuevamente online. Si reserva el mismo tipo de habitación, podrá seguir usando la misma cama o habitación.',
  },
  reservation_search: {
    en: 'If your reservation number doesn\'t work, try searching by name. If the name also doesn\'t work, your same-day booking may not yet be in the system. Please wait and try again, or contact staff.',
    zh: '如果预订号无效,请尝试用姓名搜索。如姓名也找不到,可能是当日预订尚未同步到系统。请稍后再试或联系员工。',
    ja: '予約番号でうまくいかない場合は、お名前で検索してみてください。お名前でも出てこない場合は、当日予約がシステムにまだ反映されていない可能性があります。しばらく経ってから再試行するか、スタッフまでお問い合わせください。',
    ru: 'Если номер брони не работает, попробуйте поиск по имени. Если и по имени не находит — бронь сегодняшнего дня могла ещё не попасть в систему. Подождите и повторите, либо обратитесь к сотруднику.',
    es: 'Si el número de reserva no funciona, busque por nombre. Si tampoco aparece, puede que la reserva del mismo día aún no esté en el sistema. Espere e intente de nuevo, o contacte al personal.',
  },
  room_amenities: {
    en: 'Rooms are equipped with a hairdryer, shampoo, and body wash. Toothpaste, toothbrush, towels, earplugs, chargers, plug adapters, and an iron are also always provided.',
    zh: '客房配有吹风机、洗发水、沐浴露。牙膏、牙刷、毛巾、耳塞、充电器、插头转换器和熨斗也常备提供。',
    ja: '客室にはドライヤー、シャンプー、ボディウォッシュが備え付けられています。歯磨き粉、歯ブラシ、タオル、耳栓、充電器、プラグ変換アダプター、アイロンも常にご用意しています。',
    ru: 'В номерах есть фен, шампунь, гель для душа. Зубная паста, щётка, полотенца, беруши, зарядки, переходники и утюг также всегда предоставляются.',
    es: 'Las habitaciones cuentan con secador, champú y gel de baño. Pasta dental, cepillo, toallas, tapones para oídos, cargadores, adaptadores y plancha siempre están disponibles.',
  },
  room_complaint: {
    en: 'Issues like bedding odor, heating, lack of toilet paper, or air conditioning need to be checked by staff. Please type "Talk to person" in the message box at the bottom right.',
    zh: '床品气味、暖气、卫生纸不足、空调等房间问题需要员工确认。请在右下角消息框输入 "Talk to person" 联系员工。',
    ja: '寝具のにおい、暖房、トイレットペーパー不足、エアコンなど客室のご不便はスタッフによる確認が必要です。画面右下のメッセージ欄に「Talk to person」と入力してスタッフにつないでください。',
    ru: 'Такие вопросы как запах постельного, отопление, нехватка туалетной бумаги, кондиционер — требуют проверки сотрудника. Введите "Talk to person" в окне сообщений справа внизу.',
    es: 'Problemas como olor de la ropa de cama, calefacción, falta de papel higiénico o aire acondicionado requieren verificación del personal. Escriba "Talk to person" en el cuadro de mensajes abajo a la derecha.',
  },
  room_light_switch: {
    en: 'The light switch is next to the room entrance.',
    zh: '电灯开关在房间入口旁边。',
    ja: '電気のスイッチはお部屋の入口横にあります。',
    ru: 'Выключатель находится рядом со входом в номер.',
    es: 'El interruptor de luz está junto a la entrada de la habitación.',
  },
  security_info: {
    en: 'Common areas are monitored by CCTV, and rooms use digital door locks. Only registered guests can enter.',
    zh: '公共区域设有监控,客房使用电子门锁。仅登记的客人可以进入。',
    ja: '共用スペースにはCCTVが設置されており、客室はデジタルドアロックを使用しています。登録されたお客様のみご入館いただけます。',
    ru: 'В общих зонах установлены камеры, в номерах — цифровые дверные замки. Доступ только у зарегистрированных гостей.',
    es: 'Las áreas comunes tienen cámaras CCTV y las habitaciones usan cerraduras digitales. Solo pueden acceder los huéspedes registrados.',
  },
  staff_connect: {
    en: 'You can connect with staff through the message box at the bottom right of the screen. Click the "Talk to person" button, or type "Talk to person" directly.',
    zh: '可以通过屏幕右下方的消息发送窗口联系员工。点击 "Talk to person" 按钮,或直接输入 "Talk to person"。',
    ja: '画面右下のメッセージ送信欄からスタッフとおつなぎできます。「Talk to person」ボタンを押すか、「Talk to person」と直接入力してください。',
    ru: 'Связаться с сотрудником можно через окно сообщений справа внизу экрана. Нажмите кнопку "Talk to person" или введите "Talk to person".',
    es: 'Puede conectar con el personal desde el cuadro de mensajes abajo a la derecha. Pulse el botón "Talk to person" o escríbalo directamente.',
  },
  taxi_info: {
    en: 'We do not call taxis directly from the property. If you tell us your destination, we can give you the Korean address to show the taxi driver.',
    zh: '我们不直接代叫出租车。告诉我们目的地,可提供可展示给司机的韩文地址。',
    ja: '宿泊施設から直接タクシーをお呼びすることは行っておりません。目的地をお知らせいただければ、タクシー運転手に見せる韓国語の住所をご案内できます。',
    ru: 'Мы не вызываем такси напрямую из отеля. Скажите пункт назначения — дадим корейский адрес, чтобы показать водителю.',
    es: 'No llamamos taxis directamente desde el alojamiento. Si nos dice su destino, podemos darle la dirección en coreano para mostrar al conductor.',
  },
  towel_exchange: {
    en: 'Return used towels, then take a new one. In basement rooms, put them in the basket in front of the shower; in other rooms, use the towel basket on the 2nd floor. Take a fresh towel from the basket to the right of the counter.',
    zh: '归还用过的毛巾后再取新毛巾。地下客房请放到淋浴间前的篮子,其他客房请放到2楼毛巾篮。新毛巾请从前台右侧的篮子取用。',
    ja: '使用済みのタオルは返却後、新しいタオルをお取りください。地下客室はシャワー室前のバスケットに、その他の客室は2階のタオルバスケットに返却してください。新しいタオルはカウンター右側のバスケットからお取りいただけます。',
    ru: 'Сначала верните использованные полотенца, затем берите новые. В подвальных номерах — в корзину перед душем, в других — в корзину на 2 этаже. Новое полотенце берите из корзины справа от стойки.',
    es: 'Devuelva las toallas usadas y luego tome una nueva. En las habitaciones del sótano, deposítelas en la cesta frente a la ducha; en el resto, en la cesta del piso 2. Tome toallas nuevas de la cesta a la derecha del mostrador.',
  },
  unmanned_info: {
    en: 'This is an unmanned property. Staff is not always at the front desk. Check-in is self-service at the kiosk. The entrance and common areas are open 24 hours. For help, contact staff via the message box at the bottom right.',
    zh: '本住宿为无人运营。前台并不常驻员工。入住由自助终端自行办理,大门24小时开放,公共区域也24小时可用。如需帮助,可通过右下角消息框联系员工。',
    ja: '当施設は無人運営です。フロントに常時スタッフがいるわけではありません。チェックインはキオスクでのセルフ方式で、出入口は24時間開いており、共用スペースも24時間ご利用いただけます。お困りの際は画面右下のメッセージ欄からスタッフにご連絡いただけます。',
    ru: 'Это отель без персонала на стойке. Сотрудники не всегда присутствуют. Заезд — самостоятельно через киоск. Вход и общие зоны открыты 24 часа. При необходимости свяжитесь с сотрудником через окно сообщений справа внизу.',
    es: 'Este alojamiento funciona sin personal permanente. La recepción no siempre está atendida. El check-in es autoservicio en el kiosco. La entrada y áreas comunes están abiertas 24 horas. Si necesita ayuda, contacte al personal desde el cuadro de mensajes abajo a la derecha.',
  },
  wifi_info: {
    ru: 'ID и пароль Wi-Fi написаны над выключателем или рядом с дверью в каждой комнате. Если не можете найти — обратитесь к сотруднику.',
    es: 'El ID y la contraseña del Wi-Fi están escritos encima del interruptor o cerca de la puerta de cada habitación. Si no los encuentra, contacte al personal.',
  },
  wifi_trouble: {
    en: 'If Wi-Fi is not connecting, please check that the Wi-Fi power cable and internet cable in the room are properly connected. If it still doesn\'t work, contact staff.',
    zh: '如 Wi-Fi 无法连接,请检查房间内 Wi-Fi 电源线和网线是否连接正确。如仍无效请联系员工。',
    ja: 'Wi-Fiに接続できない場合は、お部屋内のWi-Fi電源ケーブルとインターネットケーブルが正しく接続されているかご確認ください。それでも接続できない場合はスタッフまでお問い合わせください。',
    ru: 'Если Wi-Fi не подключается, проверьте, правильно ли подключены кабель питания Wi-Fi и интернет-кабель в номере. Если всё равно не работает — обратитесь к сотруднику.',
    es: 'Si el Wi-Fi no conecta, verifique que el cable de alimentación del Wi-Fi y el cable de internet de la habitación estén bien conectados. Si aún así no funciona, contacte al personal.',
  },
};

(async () => {
  // 현재 DB 상태
  const { data: existing } = await supabase
    .from('intent_answers')
    .select('intent_id, language');
  const have = new Set((existing || []).map((r) => `${r.intent_id}::${r.language || 'ko'}`));

  const rows = [];
  for (const [intent_id, langs] of Object.entries(T)) {
    for (const [language, answer_template] of Object.entries(langs)) {
      if (have.has(`${intent_id}::${language}`)) continue; // 이미 있으면 스킵
      rows.push({ intent_id, language, answer_template });
    }
  }

  console.log(`삽입 대상: ${rows.length}건`);
  if (rows.length === 0) { console.log('이미 모두 채워져 있음'); return; }

  // 100개씩 청크 삽입
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('intent_answers').insert(slice);
    if (error) {
      console.error(`[${i}] 에러:`, error.message);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length} 삽입 완료`);
  }

  // 검증
  const { data: after } = await supabase
    .from('intent_answers')
    .select('intent_id, language');
  const langCounts = {};
  after.forEach(({ language }) => {
    const l = language || 'ko';
    langCounts[l] = (langCounts[l] || 0) + 1;
  });
  console.log('\n최종 언어별 답변 수:', langCounts);
})();
