# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Portuguese (Brazil) strings.

tile-name = Status do serviço (exemplo)
tile-description = Consulta a página de status pública do GitHub e avisa quando algo dá errado. Mostra como um tile acessa a internet com tf.net.fetch.
setting-every = Verificar sozinho
setting-every-off = Só quando eu pedir
setting-every-quarter = A cada 15 minutos
setting-every-hour = A cada hora
cmd-check = Status do serviço: Verificar o GitHub agora
status-none = GitHub: todos os sistemas funcionando.
status-minor = GitHub: problemas menores ({ $description }).
status-major = GitHub: interrupção grave ({ $description }).
status-critical = GitHub: interrupção crítica ({ $description }).
status-unknown = O GitHub diz: { $description }
error-no-network = Este Tilefold ainda não permite que tiles usem a internet. Atualize o Tilefold para usar o Status do serviço.
error-denied = O Status do serviço não tem permissão para acessar www.githubstatus.com. Permita em Configurações → Tiles.
error-rate = Verificações demais. Tente de novo em um minuto.
error-failed = Não foi possível acessar a página de status do GitHub. Tente mais tarde.
error-bad-answer = A página de status do GitHub enviou uma resposta que o Status do serviço não entende.
