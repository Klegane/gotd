pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {
        stage('Deploy to Production') {
            steps {
                echo "Triggering deployment on production host..."
                sh '''
                    ssh host-server "/home/userik/gotd/deploy.sh"
                '''
            }
        }
    }

    post {
        success {
            echo "GOTD deployment succeeded!"
        }
        failure {
            echo "GOTD deployment failed! Please inspect the console log above."
        }
    }
}
