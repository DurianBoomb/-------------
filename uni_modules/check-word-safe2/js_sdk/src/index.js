"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensitiveWordTool = void 0;
const words_1 = __importDefault(require("./words"));
const defaultNoiseWords = ' \t\r\n~!@#$%^&*()_+-=【】、{}|;\':"，。、《》？αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ。，、；：？！…—·ˉ¨‘’“”々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑⒒⒓⒔⒕⒖⒗⒘⒙⒚⒛㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩①②③④⑤⑥⑦⑧⑨⑩⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇≈≡≠＝≤≥＜＞≮≯∷±＋－×÷／∫∮∝∞∧∨∑∏∪∩∈∵∴⊥∥∠⌒⊙≌∽√§№☆★○●◎◇◆□℃‰€■△▲※→←↑↓〓¤°＃＆＠＼︿＿￣―♂♀┌┍┎┐┑┒┓─┄┈├┝┞┟┠┡┢┣│┆┊┬┭┮┯┰┱┲┳┼┽┾┿╀╁╂╃└┕┖┗┘┙┚┛━┅┉┤┥┦┧┨┩┪┫┃┇┋┴┵┶┷┸┹┺┻╋╊╉╈╇╆╅╄';
class SensitiveWordTool {
    constructor(options = {}) {
        this.map = {};
        this.noiseWordMap = SensitiveWordTool.generateNoiseWordMap(defaultNoiseWords);
        const { wordList = [], noiseWords = '', useDefaultWords = false } = options;
        noiseWords && this.setNoiseWords(noiseWords);
        useDefaultWords && this.addWords(words_1.default);
        this.addWords(wordList);
    }
    static generateNoiseWordMap(noiseWords) {
        const noiseWordMap = {};
        for (let i = 0, j = noiseWords.length; i < j; i++) {
            noiseWordMap[noiseWords.charCodeAt(i)] = true;
        }
        return noiseWordMap;
    }
    static isWordEnd(point) {
        return Reflect.has(point, SensitiveWordTool.WORD_END_TAG);
    }
    filterNoiseChar(word) {
        let ignoredWord = '';
        for (let i = 0, len = word.length; i < len; i++) {
            if (!this.noiseWordMap[word.charCodeAt(i)]) {
                ignoredWord += word.charAt(i);
            }
        }
        return ignoredWord;
    }
    setNoiseWords(noiseWords) {
        this.noiseWordMap = SensitiveWordTool.generateNoiseWordMap(noiseWords);
    }
    clearWords() {
        this.map = {};
    }
    addWords(wordList) {
        for (let i = 0, len = wordList.length; i < len; i++) {
            let point = this.map;
            const word = this.filterNoiseChar(wordList[i]);
            for (let j = 0, wordLen = word.length; j < wordLen; j++) {
                const char = word.charAt(j).toLowerCase();
                const currentNode = point[char] = (point[char] || {});
                if (j === wordLen - 1) {
                    currentNode[SensitiveWordTool.WORD_END_TAG] = true;
                }
                point = currentNode;
            }
        }
    }
    match(content) {
        const result = new Set();
        let point = this.map;
        const len = content.length;
        for (let left = 0; left < len; left++) {
            const code = content.charCodeAt(left);
            if (this.noiseWordMap[code])
                continue;
            for (let right = left; right < len; right++) {
                const code = content.charCodeAt(right);
                if (this.noiseWordMap[code])
                    continue;
                const char = content.charAt(right);
                point = point[char.toLowerCase()];
                if (!point) {
                    point = this.map;
                    break;
                }
                else if (SensitiveWordTool.isWordEnd(point)) {
                    const matchedWord = this.filterNoiseChar(content.substring(left, right + 1));
                    result.add(matchedWord);
                }
            }
        }
        return Array.from(result);
    }
    verify(content) {
        let point = this.map;
        const len = content.length;
        for (let left = 0; left < len; left++) {
            const code = content.charCodeAt(left);
            if (this.noiseWordMap[code])
                continue;
            for (let right = left; right < len; right++) {
                const code = content.charCodeAt(right);
                if (this.noiseWordMap[code])
                    continue;
                const char = content.charAt(right);
                point = point[char.toLowerCase()];
                if (!point) {
                    point = this.map;
                    break;
                }
                else if (SensitiveWordTool.isWordEnd(point)) {
                    return true;
                }
            }
        }
        return false;
    }
    filter(content, filterChar = '*') {
        let filteredContent = '';
        let toReplaceCharLength = 0;
        let point = this.map;
        const len = content.length;
        for (let left = 0; left < len; left++) {
            const code = content.charCodeAt(left);
            if (this.noiseWordMap[code]) {
                filteredContent += content.charAt(left);
                toReplaceCharLength = Math.max(toReplaceCharLength - 1, 0);
                continue;
            }
            let isMatched = false;
            for (let right = left; right < len; right++) {
                const code = content.charCodeAt(right);
                if (this.noiseWordMap[code])
                    continue;
                const char = content.charAt(right);
                point = point[char.toLowerCase()];
                if (point && SensitiveWordTool.isWordEnd(point)) {
                    if (!isMatched) {
                        filteredContent += filterChar;
                    }
                    toReplaceCharLength = Math.max(toReplaceCharLength - 1, right - left);
                    isMatched = true;
                }
                else if (!point || right === len - 1) {
                    if (!isMatched) {
                        filteredContent += toReplaceCharLength > 0 ? filterChar : content.charAt(left);
                        toReplaceCharLength = Math.max(toReplaceCharLength - 1, 0);
                    }
                    point = this.map;
                    break;
                }
            }
        }
        return filteredContent;
    }
}
exports.SensitiveWordTool = SensitiveWordTool;
SensitiveWordTool.WORD_END_TAG = Symbol('WORD_END_TAG');
exports.default = SensitiveWordTool;
