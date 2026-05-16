import SensitiveWordTool from './src/index';

// 初始化时使用默认敏感词
const checkSafeWord = new SensitiveWordTool({
    useDefaultWords: true
})

export {
    checkSafeWord
};