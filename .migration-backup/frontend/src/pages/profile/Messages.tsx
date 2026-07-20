import { MainLayout } from "@/components/layout/MainLayout";
import { MessagingSystem } from "@/components/messaging/MessagingSystem";

const Messages = () => {
    return (
        <MainLayout>
            <div className="p-4 md:p-6 lg:p-8">
                <MessagingSystem />
            </div>
        </MainLayout>
    );
};

export default Messages;
