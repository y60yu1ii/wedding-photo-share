import * as cdk from "aws-cdk-lib";
export declare class CertificateStack extends cdk.Stack {
    readonly siteCertificateArn: string;
    readonly apiCertificateArn: string;
    constructor(scope: cdk.App, id: string, props: cdk.StackProps & {
        hostedZoneId: string;
    });
}
//# sourceMappingURL=certificate-stack.d.ts.map