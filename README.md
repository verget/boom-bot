#Telegram bot for city quest
builded with `node-telegram-bot-api` from https://github.com/yagop/node-telegram-bot-api
###Comand list

####For users
`/start_game` Начало игры, выставляет финишное время на сейчас + 30 минут
`/time` - Показывает оставшееся время, запускает игру, если она еще не запущена.

####For authors
`/code_list` - Показывает список кодов с их стоимостью.
`/create_code [code_name] [code_value]` - Создает новый код [code_name] со стоимостью  [code_value].
`/delete_code [code_name]` - Удаляет код с именем [code_name].
`/change_code [code_name] [code_value]` - Устанавливает стоимость [code_value] для кода [code_name] (не влияет на уже введенные юзером коды).
`/user_list` - Показывает список пользователей, начавших игру, с финишным временем и активированными кодами. 
`/clean_code [user_id] [code_name]` - Убирает отметку использования для кода [code_name] у юзера [user_id].
`/delete_user [user_id]` - Удаляет всю информацию о пользователе.
`/change_time [user_id] [time_count]` - Меняет финишное время для пользователя [user_id] на [time_count] (может быть отрицательным).
`/restart_game` - Перезагрузка, нужна для старта новой игры, команда удаляет всех сохраненных пользователей.
[code_value] - измеряется в секундах; [code_name] - строка русский или английских букв и цифр, не может начинаться с /.
 