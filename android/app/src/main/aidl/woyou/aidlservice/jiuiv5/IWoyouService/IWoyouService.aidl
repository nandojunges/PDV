package woyou.aidlservice.jiuiv5;

interface IWoyouService {
    int printerInit();
    int printText(in String text, in String charSetName);
    int lineWrap(int lines);
}
