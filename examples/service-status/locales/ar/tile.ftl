# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Arabic strings.

tile-name = حالة الخدمة (مثال)
tile-description = يتحقق من صفحة حالة GitHub العامة ويخبرك عندما يكون هناك خلل. يوضح كيف تصل البلاطة إلى الإنترنت باستخدام tf.net.fetch.
setting-every = التحقق تلقائيًا
setting-every-off = فقط عندما أطلب
setting-every-quarter = كل 15 دقيقة
setting-every-hour = كل ساعة
cmd-check = حالة الخدمة: تحقق من GitHub الآن
status-none = GitHub: جميع الأنظمة تعمل.
status-minor = GitHub: مشكلات بسيطة ({ $description }).
status-major = GitHub: انقطاع كبير ({ $description }).
status-critical = GitHub: انقطاع حرج ({ $description }).
status-unknown = يقول GitHub: { $description }
error-no-network = لا يسمح Tilefold هذا للبلاطات باستخدام الإنترنت بعد. حدّث Tilefold لاستخدام حالة الخدمة.
error-denied = لا يُسمح لحالة الخدمة بالوصول إلى www.githubstatus.com. اسمح بذلك في الإعدادات ← البلاطات.
error-rate = عمليات تحقق كثيرة جدًا. حاول مرة أخرى بعد دقيقة.
error-failed = تعذّر الوصول إلى صفحة حالة GitHub. حاول لاحقًا.
error-bad-answer = أرسلت صفحة حالة GitHub ردًا لا تفهمه حالة الخدمة.
