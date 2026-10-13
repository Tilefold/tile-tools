# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Service Status (example tile): Hindi strings.

tile-name = सेवा स्थिति (उदाहरण)
tile-description = GitHub का सार्वजनिक स्थिति पेज जाँचता है और कुछ गड़बड़ होने पर बताता है। दिखाता है कि टाइल tf.net.fetch से इंटरनेट तक कैसे पहुँचती है।
setting-every = अपने आप जाँचें
setting-every-off = केवल मेरे कहने पर
setting-every-quarter = हर 15 मिनट
setting-every-hour = हर घंटे
cmd-check = सेवा स्थिति: GitHub अभी जाँचें
status-none = GitHub: सभी सिस्टम ठीक चल रहे हैं।
status-minor = GitHub: छोटी समस्याएँ ({ $description })।
status-major = GitHub: बड़ी रुकावट ({ $description })।
status-critical = GitHub: गंभीर रुकावट ({ $description })।
status-unknown = GitHub कहता है: { $description }
error-no-network = यह Tilefold अभी टाइलों को इंटरनेट इस्तेमाल नहीं करने देता। सेवा स्थिति के लिए Tilefold अपडेट करें।
error-denied = सेवा स्थिति को www.githubstatus.com तक पहुँचने की अनुमति नहीं है। सेटिंग्स → टाइल्स में अनुमति दें।
error-rate = बहुत ज़्यादा जाँचें। एक मिनट बाद फिर कोशिश करें।
error-failed = GitHub का स्थिति पेज नहीं खुला। बाद में फिर कोशिश करें।
error-bad-answer = GitHub के स्थिति पेज ने ऐसा जवाब भेजा जिसे सेवा स्थिति नहीं समझती।
